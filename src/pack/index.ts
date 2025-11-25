/**
 * MessagePack 编解码（优化版本）
 */

import { deserialize as deserializeFunc } from './deserializer';
import { serialize as serializeFunc } from './serializer';

export const serialize = serializeFunc;
export const deserialize = deserializeFunc;

// 别名
export const encode = serializeFunc;
export const decode = deserializeFunc;

// 导出类型
export type { SerializeOptions, DeserializeOptions } from './types';
