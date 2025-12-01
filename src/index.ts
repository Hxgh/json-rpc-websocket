/**
 * JSON-RPC WebSocket Client (v2)
 * 现代化、类型安全的 JSON-RPC over WebSocket 实现
 */

// 主客户端类
export { JsonRpcWebSocketClient as default } from './core/client';
export { JsonRpcWebSocketClient } from './core/client';

// 类型导出
export type {
  // JSON-RPC 类型
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess,
  JsonRpcError,
  JsonRpcNotification,
  JsonRpcMessage,
  JsonRpcErrorCode,
  // Socket 类型
  ConnectionOptions,
  RequestOptions,
  NotificationOptions,
  StreamOptions,
  StreamController,
  SocketEvents,
  PerformanceStats,
  ConnectionState,
  MessageEventData,
  // 事件常量
  SocketEvent,
} from './types';

// MessagePack 编解码
export { encode, decode, serialize, deserialize } from './pack';
export type { SerializeOptions, DeserializeOptions } from './pack/types';

// 工具函数
export { generateUUID } from './tools';
