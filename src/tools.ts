/**
 * 生成四位随机数（十六进制）
 * @returns {string} 四位十六进制随机数
 */
export const generateHexSegment = (): string =>
  (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);

/**
 * 生成全局唯一标识符(UUID)
 * 格式: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * @returns {string} 符合RFC4122标准的UUID字符串
 */
export const generateUUID = (): string => {
  return [
    generateHexSegment() + generateHexSegment(),
    generateHexSegment(),
    generateHexSegment(),
    generateHexSegment(),
    generateHexSegment() + generateHexSegment() + generateHexSegment(),
  ].join('-');
};

/**
 * 生成简单的唯一ID（更短的标识符）
 * @param {number} [length=8] ID的长度
 * @returns {string} 指定长度的随机ID
 */
export const generateId = (length = 8): string => {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
};
