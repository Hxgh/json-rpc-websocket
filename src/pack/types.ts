export interface SerializeOptions {
  multiple?: boolean;
  invalidTypeReplacement?:
    | ((value: unknown) => boolean | number | string | [] | object | null)
    | boolean
    | number
    | string
    | []
    | object
    | null;
}

export interface DeserializeOptions {
  multiple?: boolean;
}

export type SerializableValue =
  | undefined
  | null
  | boolean
  | number
  | string
  | Date
  | Uint8Array
  | Uint8ClampedArray
  | Int8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | SerializableValue[]
  | { [key: string]: SerializableValue };

export interface ExtensionData {
  type: number;
  data: Uint8Array;
}
