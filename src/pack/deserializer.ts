/**
 * 优化的 MessagePack 反序列化器
 * 性能优化：
 * - 添加边界检查
 * - 类型安全
 * - 优化读取逻辑
 */

import type { DeserializeOptions, ExtensionData } from './types';
import { decodeUtf8 } from './utf8';

const POW32 = 0x100000000; // 2^32

export function deserialize<T = unknown>(
  array: Uint8Array | ArrayBuffer | number[],
  options?: DeserializeOptions,
): T {
  let bytes: Uint8Array;

  if (array instanceof ArrayBuffer) {
    bytes = new Uint8Array(array);
  } else if (array instanceof Uint8Array) {
    bytes = array;
  } else if (typeof array === 'object' && typeof array.length !== 'undefined') {
    bytes = new Uint8Array(array);
  } else {
    throw new Error(
      'Invalid argument type: Expected a byte array (Array or Uint8Array) to deserialize.',
    );
  }

  if (bytes.length === 0) {
    throw new Error(
      'Invalid argument: The byte array to deserialize is empty.',
    );
  }

  let pos = 0;

  if (options?.multiple) {
    const results: unknown[] = [];
    while (pos < bytes.length) {
      results.push(read());
    }
    return results as T;
  }

  return read() as T;

  function checkBounds(needed: number): void {
    if (pos + needed > bytes.length) {
      throw new Error(
        `Buffer overflow: trying to read ${needed} bytes at position ${pos}, but only ${bytes.length - pos} bytes available`,
      );
    }
  }

  function read(): unknown {
    checkBounds(1);
    const byte = bytes[pos++];

    // 固定值
    if (byte >= 0x00 && byte <= 0x7f) return byte;
    if (byte >= 0x80 && byte <= 0x8f) return readMap(byte - 0x80);
    if (byte >= 0x90 && byte <= 0x9f) return readArray(byte - 0x90);
    if (byte >= 0xa0 && byte <= 0xbf) return readStr(byte - 0xa0);
    if (byte >= 0xe0 && byte <= 0xff) return byte - 256;

    // 特殊值
    if (byte === 0xc0) return null;
    if (byte === 0xc2) return false;
    if (byte === 0xc3) return true;

    // 二进制
    if (byte === 0xc4) return readBin(-1, 1);
    if (byte === 0xc5) return readBin(-1, 2);
    if (byte === 0xc6) return readBin(-1, 4);

    // 扩展类型
    if (byte === 0xc7) return readExt(-1, 1);
    if (byte === 0xc8) return readExt(-1, 2);
    if (byte === 0xc9) return readExt(-1, 4);
    if (byte === 0xd4) return readExt(1);
    if (byte === 0xd5) return readExt(2);
    if (byte === 0xd6) return readExt(4);
    if (byte === 0xd7) return readExt(8);
    if (byte === 0xd8) return readExt(16);

    // 浮点数
    if (byte === 0xca) return readFloat(4);
    if (byte === 0xcb) return readFloat(8);

    // 无符号整数
    if (byte === 0xcc) return readUInt(1);
    if (byte === 0xcd) return readUInt(2);
    if (byte === 0xce) return readUInt(4);
    if (byte === 0xcf) return readUInt(8);

    // 有符号整数
    if (byte === 0xd0) return readInt(1);
    if (byte === 0xd1) return readInt(2);
    if (byte === 0xd2) return readInt(4);
    if (byte === 0xd3) return readInt(8);

    // 字符串
    if (byte === 0xd9) return readStr(-1, 1);
    if (byte === 0xda) return readStr(-1, 2);
    if (byte === 0xdb) return readStr(-1, 4);

    // 数组
    if (byte === 0xdc) return readArray(-1, 2);
    if (byte === 0xdd) return readArray(-1, 4);

    // 映射
    if (byte === 0xde) return readMap(-1, 2);
    if (byte === 0xdf) return readMap(-1, 4);

    // 无效字节
    if (byte === 0xc1) {
      throw new Error('Invalid byte code 0xc1 found.');
    }

    throw new Error(
      `Invalid byte value '${byte}' at index ${pos - 1} in the MessagePack binary data (length ${bytes.length}): Expecting a range of 0 to 255. This is not a byte array.`,
    );
  }

  function readInt(count: number): number {
    checkBounds(count);
    let value = 0;
    let first = true;

    for (let i = 0; i < count; i++) {
      if (first) {
        const byte = bytes[pos++];
        value += byte & 0x7f;
        if (byte & 0x80) {
          value -= 0x80;
        }
        first = false;
      } else {
        value = value * 256 + bytes[pos++];
      }
    }

    return value;
  }

  function readUInt(count: number): number {
    checkBounds(count);
    let value = 0;
    for (let i = 0; i < count; i++) {
      value = value * 256 + bytes[pos++];
    }
    return value;
  }

  function readFloat(size: number): number {
    checkBounds(size);
    const view = new DataView(bytes.buffer, pos + bytes.byteOffset, size);
    pos += size;
    if (size === 4) return view.getFloat32(0, false);
    if (size === 8) return view.getFloat64(0, false);
    return 0;
  }

  function readBin(length: number, lengthSize: number): Uint8Array {
    const finalLength = length < 0 ? readUInt(lengthSize) : length;
    checkBounds(finalLength);
    const data = bytes.subarray(pos, pos + finalLength);
    pos += finalLength;
    return data;
  }

  function readMap(
    length: number,
    lengthSize?: number,
  ): Record<string, unknown> {
    const finalLength =
      length < 0 && lengthSize !== undefined ? readUInt(lengthSize) : length;
    const data: Record<string, unknown> = {};

    for (let i = 0; i < finalLength; i++) {
      const key = read();
      if (typeof key !== 'string') {
        throw new Error(
          `Invalid map key type: expected string, got ${typeof key}`,
        );
      }
      data[key] = read();
    }

    return data;
  }

  function readArray(length: number, lengthSize?: number): unknown[] {
    const finalLength =
      length < 0 && lengthSize !== undefined ? readUInt(lengthSize) : length;
    const data: unknown[] = [];

    for (let i = 0; i < finalLength; i++) {
      data.push(read());
    }

    return data;
  }

  function readStr(length: number, lengthSize?: number): string {
    const finalLength =
      length < 0 && lengthSize !== undefined ? readUInt(lengthSize) : length;
    checkBounds(finalLength);
    const str = decodeUtf8(bytes, pos, finalLength);
    pos += finalLength;
    return str;
  }

  function readExt(length: number, lengthSize?: number): Date | ExtensionData {
    const finalLength =
      length < 0 && lengthSize !== undefined ? readUInt(lengthSize) : length;
    checkBounds(1 + finalLength);
    const type = readUInt(1);
    const data = readBin(finalLength, 0);

    if (type === 255) {
      return readExtDate(data);
    }

    return { type, data };
  }

  function readExtDate(data: Uint8Array): Date {
    if (data.length === 4) {
      const sec =
        ((data[0] << 24) >>> 0) +
        ((data[1] << 16) >>> 0) +
        ((data[2] << 8) >>> 0) +
        data[3];
      return new Date(sec * 1000);
    }

    if (data.length === 8) {
      const ns =
        ((data[0] << 22) >>> 0) +
        ((data[1] << 14) >>> 0) +
        ((data[2] << 6) >>> 0) +
        (data[3] >>> 2);
      const sec =
        (data[3] & 0x3) * POW32 +
        ((data[4] << 24) >>> 0) +
        ((data[5] << 16) >>> 0) +
        ((data[6] << 8) >>> 0) +
        data[7];
      return new Date(sec * 1000 + ns / 1000000);
    }

    if (data.length === 12) {
      const ns =
        ((data[0] << 24) >>> 0) +
        ((data[1] << 16) >>> 0) +
        ((data[2] << 8) >>> 0) +
        data[3];
      pos -= 8;
      const sec = readInt(8);
      return new Date(sec * 1000 + ns / 1000000);
    }

    throw new Error('Invalid data length for a date value.');
  }
}
