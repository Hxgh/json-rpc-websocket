import { decodeUtf8 } from './utf8';
import type { DeserializeOptions, ExtensionData } from './types';

export function deserialize(
  array: Uint8Array | ArrayBuffer | number[],
  options?: DeserializeOptions
): any {
  const pow32 = 0x100000000;
  let pos = 0;

  let bytes: Uint8Array;
  if (array instanceof ArrayBuffer) {
    bytes = new Uint8Array(array);
  } else if (array instanceof Uint8Array) {
    bytes = array;
  } else if (typeof array === 'object' && typeof array.length !== 'undefined') {
    bytes = new Uint8Array(array);
  } else {
    throw new Error(
      'Invalid argument type: Expected a byte array (Array or Uint8Array) to deserialize.'
    );
  }

  if (!bytes.length) {
    throw new Error(
      'Invalid argument: The byte array to deserialize is empty.'
    );
  }

  let data: any;
  if (options?.multiple) {
    data = [];
    while (pos < bytes.length) {
      data.push(read());
    }
  } else {
    data = read();
  }
  return data;

  function read(): any {
    const byte = bytes[pos++];
    if (byte >= 0x00 && byte <= 0x7f) return byte;
    if (byte >= 0x80 && byte <= 0x8f) return readMap(byte - 0x80);
    if (byte >= 0x90 && byte <= 0x9f) return readArray(byte - 0x90);
    if (byte >= 0xa0 && byte <= 0xbf) return readStr(byte - 0xa0);
    if (byte === 0xc0) return null;
    if (byte === 0xc1) throw new Error('Invalid byte code 0xc1 found.');
    if (byte === 0xc2) return false;
    if (byte === 0xc3) return true;
    if (byte === 0xc4) return readBin(-1, 1);
    if (byte === 0xc5) return readBin(-1, 2);
    if (byte === 0xc6) return readBin(-1, 4);
    if (byte === 0xc7) return readExt(-1, 1);
    if (byte === 0xc8) return readExt(-1, 2);
    if (byte === 0xc9) return readExt(-1, 4);
    if (byte === 0xca) return readFloat(4);
    if (byte === 0xcb) return readFloat(8);
    if (byte === 0xcc) return readUInt(1);
    if (byte === 0xcd) return readUInt(2);
    if (byte === 0xce) return readUInt(4);
    if (byte === 0xcf) return readUInt(8);
    if (byte === 0xd0) return readInt(1);
    if (byte === 0xd1) return readInt(2);
    if (byte === 0xd2) return readInt(4);
    if (byte === 0xd3) return readInt(8);
    if (byte === 0xd4) return readExt(1);
    if (byte === 0xd5) return readExt(2);
    if (byte === 0xd6) return readExt(4);
    if (byte === 0xd7) return readExt(8);
    if (byte === 0xd8) return readExt(16);
    if (byte === 0xd9) return readStr(-1, 1);
    if (byte === 0xda) return readStr(-1, 2);
    if (byte === 0xdb) return readStr(-1, 4);
    if (byte === 0xdc) return readArray(-1, 2);
    if (byte === 0xdd) return readArray(-1, 4);
    if (byte === 0xde) return readMap(-1, 2);
    if (byte === 0xdf) return readMap(-1, 4);
    if (byte >= 0xe0 && byte <= 0xff) return byte - 256;
    console.debug('msgpack array:', bytes);
    throw new Error(
      `Invalid byte value '${byte}' at index ${
        pos - 1
      } in the MessagePack binary data (length ${
        bytes.length
      }): Expecting a range of 0 to 255. This is not a byte array.`
    );
  }

  function readInt(count: number): number {
    let value = 0;
    let first = true;
    let remaining = count;
    while (remaining-- > 0) {
      if (first) {
        const byte = bytes[pos++];
        value += byte & 0x7f;
        if (byte & 0x80) {
          value -= 0x80;
        }
        first = false;
      } else {
        value *= 256;
        value += bytes[pos++];
      }
    }
    return value;
  }

  function readUInt(count: number): number {
    let value = 0;
    let remaining = count;
    while (remaining-- > 0) {
      value *= 256;
      value += bytes[pos++];
    }
    return value;
  }

  function readFloat(size: number): number {
    const view = new DataView(bytes.buffer, pos + bytes.byteOffset, size);
    pos += size;
    if (size === 4) return view.getFloat32(0, false);
    if (size === 8) return view.getFloat64(0, false);
    return 0;
  }

  function readBin(length: number, lengthSize: number): Uint8Array {
    let finalLength = length;
    if (finalLength < 0) finalLength = readUInt(lengthSize);
    const data = bytes.subarray(pos, pos + finalLength);
    pos += finalLength;
    return data;
  }

  function readMap(length: number, lengthSize?: number): Record<string, any> {
    let finalLength = length;
    if (finalLength < 0 && lengthSize !== undefined)
      finalLength = readUInt(lengthSize);
    const data: Record<string, any> = {};
    let remaining = finalLength;
    while (remaining-- > 0) {
      const key = read() as string;
      data[key] = read();
    }
    return data;
  }

  function readArray(length: number, lengthSize?: number): any[] {
    let finalLength = length;
    if (finalLength < 0 && lengthSize !== undefined)
      finalLength = readUInt(lengthSize);
    const data: any[] = [];
    let remaining = finalLength;
    while (remaining-- > 0) {
      data.push(read());
    }
    return data;
  }

  function readStr(length: number, lengthSize?: number): string {
    let finalLength = length;
    if (finalLength < 0 && lengthSize !== undefined)
      finalLength = readUInt(lengthSize);
    const start = pos;
    pos += finalLength;
    return decodeUtf8(bytes, start, finalLength);
  }

  function readExt(length: number, lengthSize?: number): Date | ExtensionData {
    let finalLength = length;
    if (finalLength < 0 && lengthSize !== undefined)
      finalLength = readUInt(lengthSize);
    const type = readUInt(1);
    const data = readBin(finalLength, 0);
    switch (type) {
      case 255:
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
        (data[3] & 0x3) * pow32 +
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
