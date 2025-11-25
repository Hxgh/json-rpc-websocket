/**
 * WebSocket 客户端类型定义
 */

import type { JsonRpcResponse } from './jsonrpc';

/**
 * WebSocket 连接状态
 */
export enum ConnectionState {
  Connecting = 0,
  Open = 1,
  Closing = 2,
  Closed = 3,
}

/**
 * 连接配置
 */
export interface ConnectionOptions {
  /** WebSocket URL */
  url: string;
  /** WebSocket 协议 */
  protocols?: string | string[];
  /** 自动重连 */
  autoReconnect?: boolean;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
  /** 默认超时时间（毫秒） */
  defaultTimeout?: number;
  /** 心跳间隔（毫秒），0 表示禁用 */
  heartbeatInterval?: number;
  /** 心跳方法名 */
  heartbeatMethod?: string;
  /** 是否启用调试日志 */
  debug?: boolean;
}

/**
 * 请求配置
 */
export interface RequestOptions<TParams = unknown> {
  /** 方法名 */
  method: string;
  /** 参数 */
  params?: TParams;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 请求 ID（可选，自动生成） */
  id?: string | number;
}

/**
 * 通知配置（不需要响应）
 */
export interface NotificationOptions<TParams = unknown> {
  /** 方法名 */
  method: string;
  /** 参数 */
  params?: TParams;
}

/**
 * 流式请求配置
 */
export interface StreamOptions<TParams = unknown> {
  /** 方法名 */
  method: string;
  /** 参数 */
  params?: TParams;
  /** 流 ID（可选，自动生成） */
  id?: string | number;
}

/**
 * 流式响应控制器
 */
export interface StreamController {
  /** 流 ID */
  readonly id: string | number;
  /** 关闭流 */
  close(): void;
  /** 流是否已关闭 */
  readonly closed: boolean;
}

/**
 * 事件类型
 */
export interface SocketEvents extends Record<string, unknown> {
  /** 连接打开 */
  open: Event;
  /** 连接关闭 */
  close: CloseEvent;
  /** 连接错误 */
  error: Event;
  /** 收到消息 */
  message: JsonRpcResponse;
  /** 重连中 */
  reconnecting: { attempt: number; maxAttempts: number };
  /** 重连成功 */
  reconnected: undefined;
  /** 重连失败 */
  reconnect_failed: undefined;
}

/**
 * 事件监听器
 */
export type EventListener<T = unknown> = (data: T) => void;

/**
 * 请求元数据
 */
export interface RequestMetadata {
  /** 请求 ID */
  id: string | number;
  /** 发送时间戳 */
  timestamp: number;
  /** 超时定时器 */
  timeoutId: NodeJS.Timeout;
  /** 成功回调 */
  resolve: (value: unknown) => void;
  /** 失败回调 */
  reject: (error: Error) => void;
}

/**
 * 性能统计
 */
export interface PerformanceStats {
  /** 发送的请求总数 */
  requestsSent: number;
  /** 接收的响应总数 */
  responsesReceived: number;
  /** 超时的请求数 */
  timeouts: number;
  /** 错误的响应数 */
  errors: number;
  /** 平均响应时间（毫秒） */
  averageResponseTime: number;
  /** 当前待处理请求数 */
  pendingRequests: number;
  /** 重连次数 */
  reconnectCount: number;
}
