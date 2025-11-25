import { encodeUtf8 } from './utf8';
import type { SerializeOptions } from './types';

export function serialize(data: any, options?: SerializeOptions): Uint8Array {
  if (options?.multiple && !Array.isArray(data)) {
    throw new Error(
      'Invalid argument type: Expected an Array to serialize multiple values.'
    );
  }

  const pow32 = 0x100000000;
  let floatBuffer: ArrayBuffer | undefined;
  let floatView: DataView | undefined;
  let array = new Uint8Array(128);
  let length = 0;

  if (options?.multiple) {
    for (let i = 0; i < data.length; i++) {
      append(data[i]);
    }
  } else {
    append(data);
  }

  return array.subarray(0, length);

  function append(data: any, isReplacement?: boolean): void {
    switch (typeof data) {
      case 'undefined':
        appendNull(data);
        break;
      case 'boolean':
        appendBoolean(data);
        break;
      case 'number':
        appendNumber(data);
        break;
      case 'string':
        appendString(data);
        break;
      case 'object':
        if (data === null) appendNull(data);
        else if (data instanceof Date) appendDate(data);
        else if (Array.isArray(data)) appendArray(data);
        else if (data instanceof Uint8Array || data instanceof Uint8ClampedArray)
          appendBinArray(data);
        else if (
          data instanceof Int8Array ||
          data instanceof Int16Array ||
          data instanceof Uint16Array ||
          data instanceof Int32Array ||
          data instanceof Uint32Array ||
          data instanceof Float32Array ||
          data instanceof Float64Array
        )
          appendArray(data);
        else appendObject(data);
        break;
      default:
        if (!isReplacement && options?.invalidTypeReplacement) {
          if (typeof options.invalidTypeReplacement === 'function')
            append(options.invalidTypeReplacement(data), true);
          else append(options.invalidTypeReplacement, true);
        } else {
          throw new Error(
            `Invalid argument type: The type '${typeof data}' cannot be serialized.`
          );
        }
    }
  }

  function appendNull(_data: null | undefined): void {
    appendByte(0xc0);
  }

  function appendBoolean(data: boolean): void {
    appendByte(data ? 0xc3 : 0xc2);
  }

  function appendNumber(data: number): void {
    if (isFinite(data) && Math.floor(data) === data) {
      if (data >= 0 && data <= 0x7f) {
        appendByte(data);
      } else if (data < 0 && data >= -0x20) {
        appendByte(data);
      } else if (data > 0 && data <= 0xff) {
        appendBytes([0xcc, data]);
      } else if (data >= -0x80 && data <= 0x7f) {
        appendBytes([0xd0, data]);
      } else if (data > 0 && data <= 0xffff) {
        appendBytes([0xcd, data >>> 8, data]);
      } else if (data >= -0x8000 && data <= 0x7fff) {
        appendBytes([0xd1, data >>> 8, data]);
      } else if (data > 0 && data <= 0xffffffff) {
        appendBytes([0xce, data >>> 24, data >>> 16, data >>> 8, data]);
      } else if (data >= -0x80000000 && data <= 0x7fffffff) {
        appendBytes([0xd2, data >>> 24, data >>> 16, data >>> 8, data]);
      } else if (data > 0 && data <= 0xffffffffffffffff) {
        const hi = data / pow32;
        const lo = data % pow32;
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
      } else if (data >= -0x8000000000000000 && data <= 0x7fffffffffffffff) {
        appendByte(0xd3);
        appendInt64(data);
      } else if (data < 0) {
        appendBytes([0xd3, 0x80, 0, 0, 0, 0, 0, 0, 0]);
      } else {
        appendBytes([0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
      }
    } else {
      if (!floatView) {
        floatBuffer = new ArrayBuffer(8);
        floatView = new DataView(floatBuffer);
      }
      floatView.setFloat64(0, data);
      appendByte(0xcb);
      appendBytes(new Uint8Array(floatBuffer as ArrayBuffer));
    }
  }

  function appendString(data: string): void {
    const bytes = encodeUtf8(data);
    const length = bytes.length;

    if (length <= 0x1f) appendByte(0xa0 + length);
    else if (length <= 0xff) appendBytes([0xd9, length]);
    else if (length <= 0xffff) appendBytes([0xda, length >>> 8, length]);
    else appendBytes([0xdb, length >>> 24, length >>> 16, length >>> 8, length]);

    appendBytes(bytes);
  }

  function appendArray(data: ArrayLike<any>): void {
    const length = data.length;

    if (length <= 0xf) appendByte(0x90 + length);
    else if (length <= 0xffff) appendBytes([0xdc, length >>> 8, length]);
    else appendBytes([0xdd, length >>> 24, length >>> 16, length >>> 8, length]);

    for (let index = 0; index < length; index++) {
      append(data[index]);
    }
  }

  function appendBinArray(data: Uint8Array | Uint8ClampedArray): void {
    const length = data.length;

    if (length <= 0xf) appendBytes([0xc4, length]);
    else if (length <= 0xffff) appendBytes([0xc5, length >>> 8, length]);
    else appendBytes([0xc6, length >>> 24, length >>> 16, length >>> 8, length]);

    appendBytes(data);
  }

  function appendObject(data: Record<string, any>): void {
    let length = 0;
    for (const key in data) {
      if (data[key] !== undefined) {
        length++;
      }
    }

    if (length <= 0xf) appendByte(0x80 + length);
    else if (length <= 0xffff) appendBytes([0xde, length >>> 8, length]);
    else appendBytes([0xdf, length >>> 24, length >>> 16, length >>> 8, length]);

    for (const key in data) {
      const value = data[key];
      if (value !== undefined) {
        append(key);
        append(value);
      }
    }
  }

  function appendDate(data: Date): void {
    const sec = data.getTime() / 1000;
    if (data.getMilliseconds() === 0 && sec >= 0 && sec < 0x100000000) {
      appendBytes([0xd6, 0xff, sec >>> 24, sec >>> 16, sec >>> 8, sec]);
    } else if (sec >= 0 && sec < 0x400000000) {
      const ns = data.getMilliseconds() * 1000000;
      appendBytes([
        0xd7,
        0xff,
        ns >>> 22,
        ns >>> 14,
        ns >>> 6,
        ((ns << 2) >>> 0) | (sec / pow32),
        sec >>> 24,
        sec >>> 16,
        sec >>> 8,
        sec,
      ]);
    } else {
      const ns = data.getMilliseconds() * 1000000;
      appendBytes([0xc7, 12, 0xff, ns >>> 24, ns >>> 16, ns >>> 8, ns]);
      appendInt64(sec);
    }
  }

  function appendByte(byte: number): void {
    if (array.length < length + 1) {
      let newLength = array.length * 2;
      while (newLength < length + 1) newLength *= 2;
      const newArray = new Uint8Array(newLength);
      newArray.set(array);
      array = newArray;
    }
    array[length] = byte;
    length++;
  }

  function appendBytes(bytes: ArrayLike<number>): void {
    if (array.length < length + bytes.length) {
      let newLength = array.length * 2;
      while (newLength < length + bytes.length) newLength *= 2;
      const newArray = new Uint8Array(newLength);
      newArray.set(array);
      array = newArray;
    }
    array.set(bytes, length);
    length += bytes.length;
  }

  function appendInt64(value: number): void {
    let hi: number;
    let lo: number;
    if (value >= 0) {
      hi = value / pow32;
      lo = value % pow32;
    } else {
      value++;
      hi = Math.abs(value) / pow32;
      lo = Math.abs(value) % pow32;
      hi = ~hi;
      lo = ~lo;
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
