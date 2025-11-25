import { serialize as serializeFunc } from './serializer';
import { deserialize as deserializeFunc } from './deserializer';

export { serialize, deserialize, encode, decode };
export type { SerializeOptions, DeserializeOptions } from './types';

const serialize = serializeFunc;
const deserialize = deserializeFunc;
const encode = serializeFunc;
const decode = deserializeFunc;
