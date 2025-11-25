/**
 * 优化的 MessagePack 序列化器
 * 性能优化：
 * - 类型安全（移除 any）
 * - 优化的 buffer 增长策略（1.5倍）
 * - 预分配常见大小
 */

import type { SerializeOptions } from './types';
import { encodeUtf8 } from './utf8';

/**
 * 可序列化的值类型
 * 使用 unknown 保持类型安全，运行时检查具体类型
 */
type SerializableValue = unknown;

const POW32 = 0x100000000; // 2^32
const MAX_SAFE_INTEGER_HIGH = 0x1fffffffffffff; // 2^53 - 1

export function serialize(
  data: SerializableValue | SerializableValue[],
  options?: SerializeOptions,
): Uint8Array {
  if (options?.multiple && !Array.isArray(data)) {
    throw new Error(
      'Invalid argument type: Expected an Array to serialize multiple values.',
    );
  }

  let floatBuffer: ArrayBuffer | undefined;
  let floatView: DataView | undefined;
  let buffer = new Uint8Array(256); // 预分配更合理的初始大小
  let length = 0;

  if (options?.multiple && Array.isArray(data)) {
    for (const item of data) {
      append(item);
    }
  } else {
    append(data);
  }

  return buffer.subarray(0, length);

  function append(value: SerializableValue, isReplacement = false): void {
    const type = typeof value;

    switch (type) {
      case 'undefined':
        appendNull();
        break;
      case 'boolean':
        appendBoolean(value as boolean);
        break;
      case 'number':
        appendNumber(value as number);
        break;
      case 'string':
        appendString(value as string);
        break;
      case 'object':
        if (value === null) {
          appendNull();
        } else if (value instanceof Date) {
          appendDate(value);
        } else if (Array.isArray(value)) {
          appendArray(value);
        } else if (
          value instanceof Uint8Array ||
          value instanceof Uint8ClampedArray
        ) {
          appendBinArray(value);
        } else if (
          value instanceof Int8Array ||
          value instanceof Int16Array ||
          value instanceof Uint16Array ||
          value instanceof Int32Array ||
          value instanceof Uint32Array ||
          value instanceof Float32Array ||
          value instanceof Float64Array
        ) {
          appendArray(Array.from(value));
        } else {
          appendObject(value as Record<string, SerializableValue>);
        }
        break;
      default:
        if (!isReplacement && options?.invalidTypeReplacement) {
          const replacement =
            typeof options.invalidTypeReplacement === 'function'
              ? options.invalidTypeReplacement(value)
              : options.invalidTypeReplacement;
          append(replacement, true);
        } else {
          throw new Error(
            `Invalid argument type: The type '${type}' cannot be serialized.`,
          );
        }
    }
  }

  function appendNull(): void {
    appendByte(0xc0);
  }

  function appendBoolean(value: boolean): void {
    appendByte(value ? 0xc3 : 0xc2);
  }

  function appendNumber(value: number): void {
    // 整数
    if (Number.isFinite(value) && Math.floor(value) === value) {
      if (value >= 0 && value <= 0x7f) {
        appendByte(value);
      } else if (value < 0 && value >= -0x20) {
        appendByte(value);
      } else if (value > 0 && value <= 0xff) {
        appendBytes([0xcc, value]);
      } else if (value >= -0x80 && value <= 0x7f) {
        appendBytes([0xd0, value]);
      } else if (value > 0 && value <= 0xffff) {
        appendBytes([0xcd, value >>> 8, value]);
      } else if (value >= -0x8000 && value <= 0x7fff) {
        appendBytes([0xd1, value >>> 8, value]);
      } else if (value > 0 && value <= 0xffffffff) {
        appendBytes([0xce, value >>> 24, value >>> 16, value >>> 8, value]);
      } else if (value >= -0x80000000 && value <= 0x7fffffff) {
        appendBytes([0xd2, value >>> 24, value >>> 16, value >>> 8, value]);
      } else if (value > 0 && value <= MAX_SAFE_INTEGER_HIGH) {
        const hi = Math.floor(value / POW32);
        const lo = Math.floor(value % POW32);
        appendBytes([
          0xd3,
          hi >>> 24,
          hi >>> 16,
          hi >>> 8,
          hi,
          lo >>> 24,
          lo >>> 16,
          lo >>> 8,
          lo,
        ]);
      } else if (value >= -MAX_SAFE_INTEGER_HIGH && value <= -0x80000001) {
        appendByte(0xd3);
        appendInt64(value);
      } else if (value < 0) {
        appendBytes([0xd3, 0x80, 0, 0, 0, 0, 0, 0, 0]);
      } else {
        appendBytes([0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
      }
    } else {
      // 浮点数
      if (!floatView) {
        floatBuffer = new ArrayBuffer(8);
        floatView = new DataView(floatBuffer);
      }
      floatView.setFloat64(0, value);
      appendByte(0xcb);
      appendBytes(new Uint8Array(floatBuffer as ArrayBuffer));
    }
  }

  function appendString(value: string): void {
    const bytes = encodeUtf8(value);
    const len = bytes.length;

    if (len <= 0x1f) {
      appendByte(0xa0 + len);
    } else if (len <= 0xff) {
      appendBytes([0xd9, len]);
    } else if (len <= 0xffff) {
      appendBytes([0xda, len >>> 8, len]);
    } else {
      appendBytes([0xdb, len >>> 24, len >>> 16, len >>> 8, len]);
    }

    appendBytes(bytes);
  }

  function appendArray(value: SerializableValue[]): void {
    const len = value.length;

    if (len <= 0xf) {
      appendByte(0x90 + len);
    } else if (len <= 0xffff) {
      appendBytes([0xdc, len >>> 8, len]);
    } else {
      appendBytes([0xdd, len >>> 24, len >>> 16, len >>> 8, len]);
    }

    for (const item of value) {
      append(item);
    }
  }

  function appendBinArray(value: Uint8Array | Uint8ClampedArray): void {
    const len = value.length;

    if (len <= 0xff) {
      appendBytes([0xc4, len]);
    } else if (len <= 0xffff) {
      appendBytes([0xc5, len >>> 8, len]);
    } else {
      appendBytes([0xc6, len >>> 24, len >>> 16, len >>> 8, len]);
    }

    appendBytes(value);
  }

  function appendObject(value: Record<string, SerializableValue>): void {
    let count = 0;
    for (const key in value) {
      if (value[key] !== undefined) {
        count++;
      }
    }

    if (count <= 0xf) {
      appendByte(0x80 + count);
    } else if (count <= 0xffff) {
      appendBytes([0xde, count >>> 8, count]);
    } else {
      appendBytes([0xdf, count >>> 24, count >>> 16, count >>> 8, count]);
    }

    for (const key in value) {
      const val = value[key];
      if (val !== undefined) {
        append(key);
        append(val);
      }
    }
  }

  function appendDate(value: Date): void {
    const sec = value.getTime() / 1000;
    if (value.getMilliseconds() === 0 && sec >= 0 && sec < POW32) {
      const secInt = Math.floor(sec);
      appendBytes([
        0xd6,
        0xff,
        secInt >>> 24,
        secInt >>> 16,
        secInt >>> 8,
        secInt,
      ]);
    } else if (sec >= 0 && sec < POW32 * 4) {
      const ns = value.getMilliseconds() * 1000000;
      const secInt = Math.floor(sec);
      const secHigh = Math.floor(secInt / POW32);
      appendBytes([
        0xd7,
        0xff,
        ns >>> 22,
        ns >>> 14,
        ns >>> 6,
        ((ns << 2) >>> 0) | secHigh,
        secInt >>> 24,
        secInt >>> 16,
        secInt >>> 8,
        secInt,
      ]);
    } else {
      const ns = value.getMilliseconds() * 1000000;
      appendBytes([0xc7, 12, 0xff, ns >>> 24, ns >>> 16, ns >>> 8, ns]);
      appendInt64(sec);
    }
  }

  function appendByte(byte: number): void {
    if (buffer.length < length + 1) {
      expandBuffer(length + 1);
    }
    buffer[length++] = byte;
  }

  function appendBytes(bytes: ArrayLike<number>): void {
    const needed = length + bytes.length;
    if (buffer.length < needed) {
      expandBuffer(needed);
    }
    buffer.set(bytes, length);
    length += bytes.length;
  }

  function expandBuffer(minSize: number): void {
    // 1.5倍增长策略，比2倍更节省内存
    let newSize = Math.ceil(buffer.length * 1.5);
    while (newSize < minSize) {
      newSize = Math.ceil(newSize * 1.5);
    }
    const newBuffer = new Uint8Array(newSize);
    newBuffer.set(buffer);
    buffer = newBuffer;
  }

  function appendInt64(num: number): void {
    let hi: number;
    let lo: number;
    if (num >= 0) {
      hi = Math.floor(num / POW32);
      lo = Math.floor(num % POW32);
    } else {
      const absValue = Math.abs(num + 1);
      hi = ~Math.floor(absValue / POW32);
      lo = ~Math.floor(absValue % POW32);
    }
    appendBytes([
      hi >>> 24,
      hi >>> 16,
      hi >>> 8,
      hi,
      lo >>> 24,
      lo >>> 16,
      lo >>> 8,
      lo,
    ]);
  }
}
