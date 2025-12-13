type Primitive = string | number | boolean | bigint | symbol | null | undefined;
type NonUndef<T> = T extends undefined ? never : T;

type IsPlainObject<T> = T extends Primitive
  ? false
  : T extends unknown[]
    ? false
    : T extends object
      ? true
      : false;

export type DeepKeyOf<T> = {
  [K in keyof T & string]: IsPlainObject<NonUndef<T[K]>> extends true
    ? K | `${K}.${DeepKeyOf<NonUndef<T[K]>>}`
    : K;
}[keyof T & string];

export type KeysOfUnion<T> = T extends T ? keyof T : never;
export type DeepKeysOfUnion<T> = T extends T ? DeepKeyOf<T> : never;
