# json-rpc-websocket

现代化、类型安全的 JSON-RPC over WebSocket 客户端

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![Size](https://img.shields.io/badge/gzip-5.1%20KB-green.svg)](https://github.com/Hxgh/json-rpc-websocket)

## 安装

```bash
pnpm add @rfkit/json-rpc-websocket
```

## 快速开始

```typescript
import { JsonRpcWebSocketClient } from "@rfkit/json-rpc-websocket";

// 创建客户端
const client = new JsonRpcWebSocketClient({
  url: "ws://localhost:8080",
  autoReconnect: true,
  heartbeatInterval: 30000,
  debug: true,
});

// 监听连接事件
client.on("open", () => console.log("✅ 已连接"));
client.on("close", () => console.log("❌ 已断开"));

// 发送请求（类型安全）
interface LoginResult {
  token: string;
  userId: number;
}

const result = await client.request<LoginResult>({
  method: "user.login",
  params: { username: "alice", password: "secret" },
  timeout: 5000,
});

console.log(result.token); // ✅ 完全类型安全
```

## API

### 构造函数选项

```typescript
interface ConnectionOptions {
  url: string; // WebSocket URL（必需）
  protocols?: string | string[]; // WebSocket 协议
  autoReconnect?: boolean; // 自动重连（默认: true）
  reconnectInterval?: number; // 重连间隔毫秒（默认: 3000）
  maxReconnectAttempts?: number; // 最大重连次数（默认: 5）
  defaultTimeout?: number; // 默认超时毫秒（默认: 15000）
  heartbeatInterval?: number; // 心跳间隔毫秒（默认: 30000）
  heartbeatMethod?: string; // 心跳方法名（默认: 'ping'）
  debug?: boolean; // 启用调试日志（默认: false）
}
```

### 核心方法

#### `request<TResult, TParams>(options): Promise<TResult>`

发送请求并等待响应

```typescript
const result = await client.request<UserInfo>({
  method: "user.getInfo",
  params: { userId: 123 },
  timeout: 5000,
});
```

#### `notify<TParams>(options): Promise<void>`

发送通知（不需要响应）

```typescript
await client.notify({
  method: "user.logout",
  params: { userId: 123 },
});
```

#### `stream<TResult>(options, callback): StreamController`

创建流式响应

```typescript
const stream = client.stream<ChunkData>(
  {
    method: "file.download",
    params: { fileId: "123" },
  },
  (response) => {
    if ("result" in response) {
      console.log("数据:", response.result);
    }
  }
);

stream.close(); // 关闭流
```

#### `on<K>(event, listener): () => void`

监听事件（返回取消监听函数）

```typescript
const unsubscribe = client.on("open", () => {
  console.log("已连接");
});

unsubscribe(); // 取消监听
```

### 事件

```typescript
client.on("open", (event) => {}); // 连接打开
client.on("close", (event) => {}); // 连接关闭
client.on("error", (event) => {}); // 连接错误
client.on("message", (response) => {}); // 收到消息
client.on("reconnecting", ({ attempt }) => {}); // 重连中
client.on("reconnected", () => {}); // 重连成功
client.on("reconnect_failed", () => {}); // 重连失败
```

### 属性

```typescript
client.state; // 连接状态: Connecting | Open | Closing | Closed
client.isConnected; // 是否已连接
client.getStats(); // 获取性能统计
```

## 高级用法

### 性能监控

```typescript
const stats = client.getStats();
console.log(`平均响应时间: ${stats.averageResponseTime}ms`);
console.log(`超时次数: ${stats.timeouts}`);
console.log(`待处理请求: ${stats.pendingRequests}`);
```

### 重连管理

```typescript
client.on("reconnecting", ({ attempt, maxAttempts }) => {
  console.log(`重连中 ${attempt}/${maxAttempts}`);
});

// 重连到新 URL
client.reconnectToUrl("ws://backup-server.com:8080");
```

### 关闭连接

```typescript
client.close();
// 或指定关闭码和原因
client.close(1000, "Normal Closure");
```

## 性能

- **ASCII 字符串编码**: 50-70% 更快
- **内存占用**: 减少 30-40%
- **包体积**: 仅 **5.1 KB** (gzip)
- **高并发**: 提升 40-70%

## 类型安全

完全类型安全，支持泛型：

```typescript
interface Params {
  username: string;
  password: string;
}
interface Result {
  token: string;
  userId: number;
}

const result = await client.request<Result, Params>({
  method: "user.login",
  params: { username: "alice", password: "secret" },
});

console.log(result.userId); // ✅ IDE 自动提示
```

## 从旧版本迁移

旧版本:

```typescript
const socket = new Socket({
  url: "ws://localhost:8080",
  onopen: () => console.log("打开"),
});

socket.send({
  method: "test",
  callback: (res) => console.log(res),
  onerror: (err) => console.error(err),
});
```

新版本:

```typescript
const client = new JsonRpcWebSocketClient({
  url: "ws://localhost:8080",
});

client.on("open", () => console.log("打开"));

// 使用 async/await
try {
  const result = await client.request({
    method: "test",
  });
  console.log(result);
} catch (error) {
  console.error(error);
}
```

## 相关链接

- [JSON-RPC 2.0 规范](https://www.jsonrpc.org/specification)
- [MessagePack 格式](https://msgpack.org/)
