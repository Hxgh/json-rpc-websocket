export function encodeUtf8(str: string): Uint8Array {
  let ascii = true;
  const length = str.length;
  for (let x = 0; x < length; x++) {
    if (str.charCodeAt(x) > 127) {
      ascii = false;
      break;
    }
  }

  let i = 0;
  const bytes = new Uint8Array(str.length * (ascii ? 1 : 4));
  for (let ci = 0; ci !== length; ci++) {
    let c = str.charCodeAt(ci);
    if (c < 128) {
      bytes[i++] = c;
      continue;
    }
    if (c < 2048) {
      bytes[i++] = (c >> 6) | 192;
    } else {
      if (c > 0xd7ff && c < 0xdc00) {
        if (++ci >= length)
          throw new Error('UTF-8 encode: incomplete surrogate pair');
        const c2 = str.charCodeAt(ci);
        if (c2 < 0xdc00 || c2 > 0xdfff)
          throw new Error(
            `UTF-8 encode: second surrogate character 0x${c2.toString(16)} at index ${ci} out of range`
          );
        c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
        bytes[i++] = (c >> 18) | 240;
        bytes[i++] = ((c >> 12) & 63) | 128;
      } else bytes[i++] = (c >> 12) | 224;
      bytes[i++] = ((c >> 6) & 63) | 128;
    }
    bytes[i++] = (c & 63) | 128;
  }
  return ascii ? bytes : bytes.subarray(0, i);
}

export function decodeUtf8(
  bytes: Uint8Array,
  start: number,
  length: number
): string {
  let i = start;
  let str = '';
  length += start;
  while (i < length) {
    let c = bytes[i++];
    if (c > 127) {
      if (c > 191 && c < 224) {
        if (i >= length)
          throw new Error('UTF-8 decode: incomplete 2-byte sequence');
        c = ((c & 31) << 6) | (bytes[i++] & 63);
      } else if (c > 223 && c < 240) {
        if (i + 1 >= length)
          throw new Error('UTF-8 decode: incomplete 3-byte sequence');
        c =
          ((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63);
      } else if (c > 239 && c < 248) {
        if (i + 2 >= length)
          throw new Error('UTF-8 decode: incomplete 4-byte sequence');
        c =
          ((c & 7) << 18) |
          ((bytes[i++] & 63) << 12) |
          ((bytes[i++] & 63) << 6) |
          (bytes[i++] & 63);
      } else
        throw new Error(
          `UTF-8 decode: unknown multibyte start 0x${c.toString(16)} at index ${i - 1}`
        );
    }
    if (c <= 0xffff) str += String.fromCharCode(c);
    else if (c <= 0x10ffff) {
      c -= 0x10000;
      str += String.fromCharCode((c >> 10) | 0xd800);
      str += String.fromCharCode((c & 0x3ff) | 0xdc00);
    } else
      throw new Error(
        `UTF-8 decode: code point 0x${c.toString(16)} exceeds UTF-16 reach`
      );
  }
  return str;
}
