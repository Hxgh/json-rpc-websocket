/**
 * 优化的 UTF-8 编解码
 * 性能优化：
 * - ASCII 快速路径（零拷贝）
 * - 动态内存分配策略（1.5倍增长）
 * - 减少边界检查次数
 */

/**
 * 编码 UTF-8（优化版本）
 */
export function encodeUtf8(str: string): Uint8Array {
  const length = str.length;

  // 快速检查是否为纯 ASCII
  let ascii = true;
  for (let i = 0; i < length; i++) {
    if (str.charCodeAt(i) > 127) {
      ascii = false;
      break;
    }
  }

  // ASCII 快速路径：直接映射
  if (ascii) {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = str.charCodeAt(i);
    }
    return bytes;
  }

  // 非 ASCII：预估 2 倍空间（大部分情况够用）
  let bytes = new Uint8Array(length * 2);
  let pos = 0;

  for (let i = 0; i < length; i++) {
    let code = str.charCodeAt(i);

    // 确保有足够空间（最坏情况需要 4 字节）
    if (pos + 4 > bytes.length) {
      const newBytes = new Uint8Array(Math.ceil(bytes.length * 1.5));
      newBytes.set(bytes);
      bytes = newBytes;
    }

    if (code < 0x80) {
      // 1 字节：0xxxxxxx
      bytes[pos++] = code;
    } else if (code < 0x800) {
      // 2 字节：110xxxxx 10xxxxxx
      bytes[pos++] = 0xc0 | (code >>> 6);
      bytes[pos++] = 0x80 | (code & 0x3f);
    } else if (code >= 0xd800 && code < 0xdc00) {
      // 代理对（4 字节）
      if (i + 1 >= length) {
        throw new Error('UTF-8 encode: incomplete surrogate pair');
      }
      const code2 = str.charCodeAt(++i);
      if (code2 < 0xdc00 || code2 > 0xdfff) {
        throw new Error(
          `UTF-8 encode: second surrogate character 0x${code2.toString(16)} at index ${i} out of range`,
        );
      }
      code = 0x10000 + ((code & 0x3ff) << 10) + (code2 & 0x3ff);
      bytes[pos++] = 0xf0 | (code >>> 18);
      bytes[pos++] = 0x80 | ((code >>> 12) & 0x3f);
      bytes[pos++] = 0x80 | ((code >>> 6) & 0x3f);
      bytes[pos++] = 0x80 | (code & 0x3f);
    } else {
      // 3 字节：1110xxxx 10xxxxxx 10xxxxxx
      bytes[pos++] = 0xe0 | (code >>> 12);
      bytes[pos++] = 0x80 | ((code >>> 6) & 0x3f);
      bytes[pos++] = 0x80 | (code & 0x3f);
    }
  }

  // 返回实际使用的部分
  return bytes.subarray(0, pos);
}

/**
 * 解码 UTF-8（优化版本）
 */
export function decodeUtf8(
  bytes: Uint8Array,
  start: number,
  length: number,
): string {
  const end = start + length;

  // 快速检查是否为纯 ASCII
  let ascii = true;
  for (let i = start; i < end; i++) {
    if (bytes[i] > 127) {
      ascii = false;
      break;
    }
  }

  // ASCII 快速路径：直接转换
  if (ascii) {
    return String.fromCharCode(...bytes.subarray(start, end));
  }

  // 非 ASCII：逐字节解码
  let str = '';
  let i = start;

  while (i < end) {
    const byte1 = bytes[i++];

    if (byte1 < 0x80) {
      // 1 字节
      str += String.fromCharCode(byte1);
    } else if (byte1 < 0xe0) {
      // 2 字节
      if (i >= end) {
        throw new Error('UTF-8 decode: incomplete 2-byte sequence');
      }
      const byte2 = bytes[i++];
      str += String.fromCharCode(((byte1 & 0x1f) << 6) | (byte2 & 0x3f));
    } else if (byte1 < 0xf0) {
      // 3 字节
      if (i + 1 >= end) {
        throw new Error('UTF-8 decode: incomplete 3-byte sequence');
      }
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      str += String.fromCharCode(
        ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f),
      );
    } else {
      // 4 字节（代理对）
      if (i + 2 >= end) {
        throw new Error('UTF-8 decode: incomplete 4-byte sequence');
      }
      const byte2 = bytes[i++];
      const byte3 = bytes[i++];
      const byte4 = bytes[i++];
      let code =
        ((byte1 & 0x07) << 18) |
        ((byte2 & 0x3f) << 12) |
        ((byte3 & 0x3f) << 6) |
        (byte4 & 0x3f);

      if (code <= 0xffff) {
        str += String.fromCharCode(code);
      } else if (code <= 0x10ffff) {
        code -= 0x10000;
        str += String.fromCharCode(0xd800 | (code >>> 10));
        str += String.fromCharCode(0xdc00 | (code & 0x3ff));
      } else {
        throw new Error(
          `UTF-8 decode: code point 0x${code.toString(16)} exceeds UTF-16 reach`,
        );
      }
    }
  }

  return str;
}
