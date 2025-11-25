# json-rpc-websocket

现代化、类型安全的 JSON-RPC over WebSocket 客户端

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

## ✨ 特性

- 🔒 **完全类型安全** - 100% TypeScript，完整的泛型支持
- 🚀 **极致性能** - 优化的 MessagePack 编解码，零拷贝策略
- 🔄 **自动重连** - 内置智能重连机制，可配置重连策略
- 💓 **心跳检测** - 自动保持连接活跃
- 📊 **性能监控** - 实时统计请求、响应、延迟等指标
- 🌊 **流式响应** - 支持长连接流式数据传输
- 🎯 **事件驱动** - 类型安全的事件系统
- 📦 **轻量级** - 仅 **5.1 KB** (gzip)

## 📦 安装

```bash
pnpm add @rfkit/json-rpc-websocket
# 或
npm install @rfkit/json-rpc-websocket
# 或
yarn add @rfkit/json-rpc-websocket
```

## 🚀 快速开始

### 基本用法

```typescript
import { JsonRpcWebSocketClient } from "@rfkit/json-rpc-websocket";

// 创建客户端
const client = new JsonRpcWebSocketClient({
  url: "ws://localhost:8080",
  autoReconnect: true, // 自动重连（默认开启）
  maxReconnectAttempts: 5, // 最大重连次数
  reconnectInterval: 3000, // 重连间隔 3秒
  defaultTimeout: 15000, // 默认超时 15秒
  heartbeatInterval: 30000, // 心跳间隔（默认0关闭，需后端支持）
  heartbeatMethod: "ping", // 心跳方法名
  debug: true, // 启用调试日志
});

// 监听连接事件
client.on("open", () => {
  console.log("✅ 已连接");
});

client.on("close", () => {
  console.log("❌ 已断开");
});

client.on("error", (error) => {
  console.error("错误:", error);
});
```

### 发送请求（类型安全）

```typescript
// 定义请求和响应类型
interface LoginParams {
  username: string;
  password: string;
}

interface LoginResult {
  token: string;
  userId: number;
  username: string;
}

// 发送请求并获得类型安全的响应
const result = await client.request<LoginResult, LoginParams>({
  method: "user.login",
  params: {
    username: "alice",
    password: "secret123",
  },
  timeout: 5000, // 可选的超时设置
});

console.log(result.token); // ✅ 完全类型安全
console.log(result.userId); // ✅ IDE 自动提示
```

### 发送通知（无需响应）

```typescript
// 发送通知，不需要等待响应
await client.notify({
  method: "user.logout",
  params: { userId: 123 },
});
```

### 流式响应

```typescript
interface ChunkData {
  progress: number;
  data: string;
}

// 创建流式连接
const stream = client.stream<ChunkData>(
  {
    method: "file.download",
    params: { fileId: "123" },
  },
  (response) => {
    if ("result" in response) {
      console.log("进度:", response.result.progress);
      console.log("数据:", response.result.data);
    } else if ("error" in response) {
      console.error("错误:", response.error);
    }
  }
);

// 稍后取消流
stream.close();
```

### 性能监控

```typescript
// 获取实时性能统计
const stats = client.getStats();

console.log(`
  发送的请求数: ${stats.requestsSent}
  接收的响应数: ${stats.responsesReceived}
  超时的请求数: ${stats.timeouts}
  错误的响应数: ${stats.errors}
  平均响应时间: ${stats.averageResponseTime}ms
  待处理请求数: ${stats.pendingRequests}
  重连次数: ${stats.reconnectCount}
`);
```

### 监听所有消息

```typescript
// 监听所有收到的消息
client.on("message", (response) => {
  console.log("收到消息:", response);

  if ("error" in response) {
    console.error("RPC 错误:", response.error);
  } else {
    console.log("RPC 结果:", response.result);
  }
});
```

### 重连管理

```typescript
// 监听重连事件
client.on("reconnecting", ({ attempt, maxAttempts }) => {
  console.log(`正在重连 ${attempt}/${maxAttempts}...`);
});

client.on("reconnected", () => {
  console.log("✅ 重连成功");
});

client.on("reconnect_failed", () => {
  console.error("❌ 重连失败，已达到最大重连次数");
});

// 手动重连到新 URL
client.reconnectToUrl("ws://backup.server.com:8080");
```

## 🔧 API 参考

### `JsonRpcWebSocketClient`

#### 构造函数选项

```typescript
interface ConnectionOptions {
  url: string; // WebSocket URL（必需）
  protocols?: string | string[]; // WebSocket 协议
  autoReconnect?: boolean; // 自动重连（默认: true，设为 false 可关闭）
  reconnectInterval?: number; // 重连间隔毫秒数（默认: 3000）
  maxReconnectAttempts?: number; // 最大重连次数（默认: 5，可自定义）
  defaultTimeout?: number; // 默认超时毫秒数（默认: 15000）
  heartbeatInterval?: number; // 心跳间隔毫秒数（默认: 0 关闭，需后端支持 heartbeatMethod）
  heartbeatMethod?: string; // 心跳方法名（默认: 'ping'）
  debug?: boolean; // 启用调试日志（默认: false）
}
```

#### 方法

##### `request<TResult, TParams>(options): Promise<TResult>`

发送请求并等待响应

```typescript
const result = await client.request<UserInfo, { userId: number }>({
  method: "user.getInfo",
  params: { userId: 123 },
  timeout: 5000, // 可选
  id: "custom-id", // 可选
});
```

##### `notify<TParams>(options): Promise<void>`

发送通知（不需要响应）

```typescript
await client.notify({
  method: "user.logout",
  params: { userId: 123 },
});
```

##### `stream<TResult, TParams>(options, callback): StreamController`

创建流式响应

```typescript
const stream = client.stream<Data>(
  {
    method: "subscribe",
    params: { channel: "updates" },
  },
  (response) => {
    // 处理每个响应
  }
);

// 返回流控制器
stream.close(); // 关闭流
stream.closed; // 检查流是否已关闭
stream.id; // 流 ID
```

##### `on<K extends keyof SocketEvents>(event, listener): () => void`

监听事件（返回取消监听函数）

```typescript
const unsubscribe = client.on("open", () => {
  console.log("已连接");
});

// 取消监听
unsubscribe();
```

##### `once<K extends keyof SocketEvents>(event, listener): () => void`

监听一次事件

```typescript
client.once("open", () => {
  console.log("首次连接");
});
```

##### `close(code?, reason?): void`

关闭连接

```typescript
client.close();
// 或
client.close(1000, "Normal Closure");
```

##### `reconnectToUrl(url): void`

重连到新 URL

```typescript
client.reconnectToUrl("ws://new-server.com:8080");
```

##### `getStats(): PerformanceStats`

获取性能统计

```typescript
const stats = client.getStats();
```

#### 事件

```typescript
interface SocketEvents {
  open: Event; // 连接打开
  close: CloseEvent; // 连接关闭
  error: Event; // 连接错误
  message: JsonRpcResponse; // 收到消息
  reconnecting: {
    // 重连中
    attempt: number;
    maxAttempts: number;
  };
  reconnected: void; // 重连成功
  reconnect_failed: void; // 重连失败
}
```

#### 属性

```typescript
client.state; // 连接状态: Connecting | Open | Closing | Closed
client.isConnected; // 是否已连接
```

## 📊 性能

经过优化的 MessagePack 实现和智能内存管理：

- **ASCII 字符串编码**: 50-70% 更快
- **内存占用**: 减少 30-40%
- **包体积**: 仅 **5.1 KB** (gzip)
- **高并发性能**: 提升 40-70%

## 🔒 类型安全

完全类型安全，支持泛型：

```typescript
// 请求和响应都是类型安全的
interface Params {
  /* ... */
}
interface Result {
  /* ... */
}

const result = await client.request<Result, Params>({
  method: "api.call",
  params: {
    /* 类型检查 */
  },
});

// result 是 Result 类型，完全类型安全
console.log(result.someField); // ✅ IDE 自动提示
```

## 🏗️ 架构

```
src/
├── types/              # 类型定义
│   ├── jsonrpc.ts      # JSON-RPC 2.0 规范类型
│   └── socket.ts       # WebSocket 客户端类型
├── core/               # 核心实现
│   ├── client.ts       # 主客户端类
│   └── event-emitter.ts # 事件系统
├── pack/               # MessagePack 编解码
│   ├── serializer.ts   # 序列化器
│   ├── deserializer.ts # 反序列化器
│   └── utf8.ts         # UTF-8 编解码
├── tools.ts            # 工具函数
└── index.ts            # 主入口
```

## 🤝 迁移指南

### 从旧版本迁移

旧版本代码:

```typescript
import Socket from "json-rpc-websocket";

const socket = new Socket({
  url: "ws://localhost:8080",
  onopen: () => console.log("打开"),
  onmessage: (msg) => console.log(msg),
});

socket.send({
  method: "test",
  params: { foo: "bar" },
  callback: (res) => console.log(res),
  onerror: (err) => console.error(err),
});
```

新版本代码:

```typescript
import { JsonRpcWebSocketClient } from "json-rpc-websocket";

const client = new JsonRpcWebSocketClient({
  url: "ws://localhost:8080",
});

client.on("open", () => console.log("打开"));
client.on("message", (msg) => console.log(msg));

// 使用 async/await（更现代）
try {
  const result = await client.request({
    method: "test",
    params: { foo: "bar" },
  });
  console.log(result);
} catch (error) {
  console.error(error);
}
```

## 📝 许可证

MIT

## 🔗 相关链接

- [JSON-RPC 2.0 规范](https://www.jsonrpc.org/specification)
- [MessagePack 格式](https://msgpack.org/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
