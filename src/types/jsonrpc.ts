/**
 * JSON-RPC 2.0 核心类型定义
 * 完全符合规范: https://www.jsonrpc.org/specification
 */

/**
 * JSON-RPC 2.0 请求
 */
export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
  id?: string | number | null;
}

/**
 * JSON-RPC 2.0 成功响应
 */
export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: '2.0';
  result: T;
  id: string | number | null;
}

/**
 * JSON-RPC 2.0 错误响应
 */
export interface JsonRpcError {
  jsonrpc: '2.0';
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

/**
 * JSON-RPC 2.0 通知（无需响应）
 */
export interface JsonRpcNotification<T = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: T;
}

/**
 * JSON-RPC 2.0 响应（成功或错误）
 */
export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcError;

/**
 * JSON-RPC 2.0 消息（请求、响应或通知）
 */
export type JsonRpcMessage<T = unknown> =
  | JsonRpcRequest<T>
  | JsonRpcResponse<T>
  | JsonRpcNotification<T>;

/**
 * 标准错误码
 */
export enum JsonRpcErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerError = -32000,
  Timeout = -32001,
  ConnectionClosed = -32002,
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  id: string | number | null,
  code: JsonRpcErrorCode,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: '2.0',
    error: { code, message, data },
    id,
  };
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  id: string | number | null,
  result: T,
): JsonRpcSuccess<T> {
  return {
    jsonrpc: '2.0',
    result,
    id,
  };
}

/**
 * 类型守卫：检查是否为错误响应
 */
export function isJsonRpcError(
  response: JsonRpcResponse,
): response is JsonRpcError {
  return 'error' in response;
}

/**
 * 类型守卫：检查是否为成功响应
 */
export function isJsonRpcSuccess<T>(
  response: JsonRpcResponse<T>,
): response is JsonRpcSuccess<T> {
  return 'result' in response;
}

/**
 * 类型守卫：检查是否为通知
 */
export function isJsonRpcNotification(
  message: JsonRpcMessage,
): message is JsonRpcNotification {
  return 'method' in message && !('id' in message);
}
