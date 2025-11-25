/**
 * 现代化 JSON-RPC WebSocket 客户端
 * 特性：
 * - 完全类型安全
 * - 自动重连
 * - 请求超时
 * - 心跳检测
 * - 流式响应
 * - 性能监控
 */

import { decode, encode } from '../pack';
import { generateUUID } from '../tools';
import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from '../types/jsonrpc';
import { JsonRpcErrorCode } from '../types/jsonrpc';
import type {
  ConnectionOptions,
  NotificationOptions,
  PerformanceStats,
  RequestMetadata,
  RequestOptions,
  SocketEvents,
  StreamController,
  StreamOptions,
} from '../types/socket';
import { ConnectionState } from '../types/socket';
import { EventEmitter } from './event-emitter';

const DEFAULT_OPTIONS: Required<Omit<ConnectionOptions, 'url' | 'protocols'>> =
  {
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    defaultTimeout: 15000,
    heartbeatInterval: 30000,
    heartbeatMethod: 'ping',
    debug: false,
  };

export class JsonRpcWebSocketClient extends EventEmitter<SocketEvents> {
  private ws: WebSocket | null = null;
  private options: ConnectionOptions & typeof DEFAULT_OPTIONS;
  private pendingRequests = new Map<string | number, RequestMetadata>();
  private streamCallbacks = new Map<
    string | number,
    (response: JsonRpcResponse) => void
  >();
  private reconnectAttempts = 0;
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private stats: PerformanceStats = {
    requestsSent: 0,
    responsesReceived: 0,
    timeouts: 0,
    errors: 0,
    averageResponseTime: 0,
    pendingRequests: 0,
    reconnectCount: 0,
  };
  private responseTimes: number[] = [];

  constructor(options: ConnectionOptions) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.connect();
  }

  /**
   * 获取连接状态
   */
  get state(): ConnectionState {
    return this.ws?.readyState ?? ConnectionState.Closed;
  }

  /**
   * 是否已连接
   */
  get isConnected(): boolean {
    return this.state === ConnectionState.Open;
  }

  /**
   * 获取性能统计
   */
  getStats(): Readonly<PerformanceStats> {
    return { ...this.stats, pendingRequests: this.pendingRequests.size };
  }

  /**
   * 建立连接
   */
  private connect(): void {
    if (this.ws && this.ws.readyState === ConnectionState.Connecting) {
      return;
    }

    try {
      this.ws = new WebSocket(this.options.url, this.options.protocols);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
    } catch (error) {
      this.log('Connection error:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * 处理连接打开
   */
  private handleOpen(event: Event): void {
    this.log('Connection opened');
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.emit('open', event);
  }

  /**
   * 处理收到消息
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const response = decode(new Uint8Array(event.data)) as JsonRpcResponse;

      this.log('Received:', response);

      // 统计
      this.stats.responsesReceived++;

      // 检查是否为错误响应
      if ('error' in response) {
        this.stats.errors++;
      }

      // 处理流式响应
      if (response.id !== null) {
        const streamCallback = this.streamCallbacks.get(response.id);
        if (streamCallback) {
          streamCallback(response);
          this.emit('message', response);
          return;
        }

        // 处理普通响应
        const metadata = this.pendingRequests.get(response.id);
        if (metadata) {
          clearTimeout(metadata.timeoutId);
          this.pendingRequests.delete(response.id);

          // 计算响应时间
          const responseTime = Date.now() - metadata.timestamp;
          this.updateResponseTime(responseTime);

          if ('error' in response) {
            metadata.reject(
              new Error(`${response.error.message} (${response.error.code})`),
            );
          } else {
            metadata.resolve(response.result);
          }
        }
      }

      this.emit('message', response);
    } catch (error) {
      this.log('Failed to decode message:', error);
    }
  }

  /**
   * 处理连接关闭
   */
  private handleClose(event: CloseEvent): void {
    this.log('Connection closed:', event.code, event.reason);
    this.stopHeartbeat();
    this.emit('close', event);

    // 拒绝所有待处理的请求
    this.rejectAllPendingRequests(
      new Error('Connection closed'),
      JsonRpcErrorCode.ConnectionClosed,
    );

    // 自动重连
    if (this.options.autoReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * 处理连接错误
   */
  private handleError(event: Event): void {
    this.log('Connection error:', event);
    this.emit('error', event);
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.emit('reconnect_failed', undefined);
      return;
    }

    this.reconnectAttempts++;
    this.stats.reconnectCount++;

    this.log(
      `Reconnecting in ${this.options.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`,
    );

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts,
    });

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect();
    }, this.options.reconnectInterval);
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (
      this.options.heartbeatInterval <= 0 ||
      this.heartbeatIntervalId !== null
    ) {
      return;
    }

    this.heartbeatIntervalId = setInterval(() => {
      if (this.isConnected) {
        this.notify({
          method: this.options.heartbeatMethod,
        }).catch((error) => {
          this.log('Heartbeat failed:', error);
        });
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  /**
   * 拒绝所有待处理的请求
   */
  private rejectAllPendingRequests(error: Error, code: JsonRpcErrorCode): void {
    for (const [id, metadata] of this.pendingRequests) {
      clearTimeout(metadata.timeoutId);
      metadata.reject(error);
    }
    this.pendingRequests.clear();
  }

  /**
   * 更新响应时间统计
   */
  private updateResponseTime(time: number): void {
    this.responseTimes.push(time);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    this.stats.averageResponseTime =
      this.responseTimes.reduce((sum, t) => sum + t, 0) /
      this.responseTimes.length;
  }

  /**
   * 发送请求
   */
  async request<TResult = unknown, TParams = unknown>(
    options: RequestOptions<TParams>,
  ): Promise<TResult> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const id = options.id ?? generateUUID();
    const request: JsonRpcRequest<TParams> = {
      jsonrpc: '2.0',
      method: options.method,
      params: options.params,
      id,
    };

    return new Promise<TResult>((resolve, reject) => {
      const timeout = options.timeout ?? this.options.defaultTimeout;
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.stats.timeouts++;
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        id,
        timestamp: Date.now(),
        timeoutId,
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      try {
        const encoded = encode(request);
        this.ws?.send(encoded);
        this.stats.requestsSent++;
        this.log('Sent request:', request);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * 发送通知（不需要响应）
   */
  async notify<TParams = unknown>(
    options: NotificationOptions<TParams>,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const notification: JsonRpcNotification<TParams> = {
      jsonrpc: '2.0',
      method: options.method,
      params: options.params,
    };

    const encoded = encode(notification);
    this.ws?.send(encoded);
    this.log('Sent notification:', notification);
  }

  /**
   * 创建流式请求
   */
  stream<TResult = unknown, TParams = unknown>(
    options: StreamOptions<TParams>,
    callback: (response: JsonRpcResponse<TResult>) => void,
  ): StreamController {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const id = options.id ?? generateUUID();
    const request: JsonRpcRequest<TParams> = {
      jsonrpc: '2.0',
      method: options.method,
      params: options.params,
      id,
    };

    let closed = false;

    this.streamCallbacks.set(id, callback as never);

    try {
      const encoded = encode(request);
      this.ws?.send(encoded);
      this.stats.requestsSent++;
      this.log('Sent stream request:', request);
    } catch (error) {
      this.streamCallbacks.delete(id);
      throw error;
    }

    return {
      id,
      close: () => {
        if (!closed) {
          closed = true;
          this.streamCallbacks.delete(id);
          this.log('Stream closed:', id);
        }
      },
      get closed() {
        return closed;
      },
    };
  }

  /**
   * 关闭连接
   */
  close(code?: number, reason?: string): void {
    this.options.autoReconnect = false;

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(code, reason);
      this.ws = null;
    }

    this.rejectAllPendingRequests(
      new Error('Connection closed by client'),
      JsonRpcErrorCode.ConnectionClosed,
    );

    this.removeAllListeners();
  }

  /**
   * 更换 URL 并重连
   */
  reconnectToUrl(url: string): void {
    this.close();
    this.options.url = url;
    this.options.autoReconnect = true;
    this.reconnectAttempts = 0;
    this.connect();
  }

  /**
   * 调试日志
   */
  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[JsonRpcWebSocket]', ...args);
    }
  }
}
