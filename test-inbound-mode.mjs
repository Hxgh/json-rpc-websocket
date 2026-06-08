import { WebSocket, WebSocketServer } from 'ws';
import JSONRPCWebSocket, { SocketEvent, decode, encode } from './dist/index.js';

globalThis.WebSocket = WebSocket;

function waitForOpen(client) {
  return new Promise((resolve) => client.on(SocketEvent.Open, resolve));
}

function waitForMessage(client) {
  return new Promise((resolve) => client.on(SocketEvent.Message, resolve));
}

async function withServer(handler) {
  const server = new WebSocketServer({ port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  server.on('connection', handler);

  return {
    url: `ws://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

const decodedServer = await withServer((socket) => {
  setTimeout(() => {
    socket.send(encode({ jsonrpc: '2.0', result: 'ok', id: 1 }));
  }, 10);
});
const decodedClient = new JSONRPCWebSocket({
  url: decodedServer.url,
  autoReconnect: false,
});
const decodedMessage = await waitForMessage(decodedClient);

if (decodedMessage.decoded !== true || decodedMessage.data.result !== 'ok') {
  throw new Error('default decode mode failed');
}

decodedClient.close();
await decodedServer.close();

let rawNotifyDecoded;
const rawServer = await withServer((socket) => {
  socket.on('message', (data) => {
    rawNotifyDecoded = decode(new Uint8Array(data));
  });
  setTimeout(() => {
    socket.send(Uint8Array.from([1, 2, 3, 4]));
  }, 10);
});
const rawClient = new JSONRPCWebSocket({
  url: rawServer.url,
  autoReconnect: false,
  inboundMode: 'raw',
});
const rawMessagePromise = waitForMessage(rawClient);

await waitForOpen(rawClient);
await rawClient.notify({ method: 'login' });

const rawMessage = await rawMessagePromise;

if (rawMessage.decoded !== false || rawMessage.rawData.byteLength !== 4) {
  throw new Error('raw inbound mode failed');
}

if (rawNotifyDecoded?.method !== 'login') {
  throw new Error('raw mode notify did not encode outbound notification');
}

let requestFailed = false;

try {
  await rawClient.request({ method: 'echo' });
} catch (error) {
  requestFailed =
    error instanceof Error && error.message.includes('Inbound raw mode');
}

if (!requestFailed) {
  throw new Error('raw mode request did not fail fast');
}

let streamFailed = false;

try {
  rawClient.stream({ method: 'stream' }, () => undefined);
} catch (error) {
  streamFailed =
    error instanceof Error && error.message.includes('Inbound raw mode');
}

if (!streamFailed) {
  throw new Error('raw mode stream did not fail fast');
}

rawClient.close();
await rawServer.close();

console.log('json-rpc-websocket inbound mode smoke tests passed');
