/**
 * Tag model for the Named Binary Tag (NBT) format.
 *
 * The format is a public specification; this module models it as a tagged union
 * so an encoder and a decoder can share one description of every tag kind.
 */

export type NbtTagType =
  | "byte"
  | "short"
  | "int"
  | "long"
  | "float"
  | "double"
  | "byteArray"
  | "string"
  | "list"
  | "compound"
  | "intArray"
  | "longArray";

/** Numeric id written to the byte stream for each tag kind. */
export const TAG_IDS: Record<NbtTagType, number> = {
  byte: 1,
  short: 2,
  int: 3,
  long: 4,
  float: 5,
  double: 6,
  byteArray: 7,
  string: 8,
  list: 9,
  compound: 10,
  intArray: 11,
  longArray: 12,
};

/** `TAG_End` — element type of an empty list, and the terminator concept in the spec. */
export const TAG_END = 0;

const ID_TO_TYPE: Record<number, NbtTagType> = Object.fromEntries(
  Object.entries(TAG_IDS).map(([name, id]) => [id, name as NbtTagType]),
) as Record<number, NbtTagType>;

export function tagTypeFromId(id: number): NbtTagType {
  const type = ID_TO_TYPE[id];
  if (!type) {
    throw new RangeError(`Unknown NBT tag id: ${id}`);
  }
  return type;
}

export interface ByteTag {
  type: "byte";
  value: number;
}
export interface ShortTag {
  type: "short";
  value: number;
}
export interface IntTag {
  type: "int";
  value: number;
}
export interface LongTag {
  type: "long";
  value: bigint;
}
export interface FloatTag {
  type: "float";
  value: number;
}
export interface DoubleTag {
  type: "double";
  value: number;
}
export interface ByteArrayTag {
  type: "byteArray";
  value: Int8Array;
}
export interface StringTag {
  type: "string";
  value: string;
}
export interface ListTag {
  type: "list";
  elementType: NbtTagType | "end";
  value: NbtTag[];
}
export interface CompoundTag {
  type: "compound";
  value: Record<string, NbtTag>;
}
export interface IntArrayTag {
  type: "intArray";
  value: Int32Array;
}
export interface LongArrayTag {
  type: "longArray";
  value: bigint[];
}

export type NbtTag =
  | ByteTag
  | ShortTag
  | IntTag
  | LongTag
  | FloatTag
  | DoubleTag
  | ByteArrayTag
  | StringTag
  | ListTag
  | CompoundTag
  | IntArrayTag
  | LongArrayTag;

export type Compound = CompoundTag;

export const byte = (value: number): ByteTag => ({ type: "byte", value });
export const short = (value: number): ShortTag => ({ type: "short", value });
export const int = (value: number): IntTag => ({ type: "int", value });
export const long = (value: number | bigint): LongTag => ({
  type: "long",
  value: BigInt(value),
});
export const float = (value: number): FloatTag => ({ type: "float", value });
export const double = (value: number): DoubleTag => ({ type: "double", value });
export const string = (value: string): StringTag => ({ type: "string", value });
export const byteArray = (value: Int8Array | number[]): ByteArrayTag => ({
  type: "byteArray",
  value: value instanceof Int8Array ? value : new Int8Array(value),
});
export const intArray = (value: Int32Array | number[]): IntArrayTag => ({
  type: "intArray",
  value: value instanceof Int32Array ? value : new Int32Array(value),
});
export const longArray = (value: (bigint | number)[]): LongArrayTag => ({
  type: "longArray",
  value: value.map((v) => BigInt(v)),
});
export const compound = (value: Record<string, NbtTag>): CompoundTag => ({
  type: "compound",
  value,
});
export const list = (
  elementType: NbtTagType | "end",
  value: NbtTag[],
): ListTag => ({ type: "list", elementType, value });

/** An empty `TAG_End`-typed list, which is how NBT represents "no elements". */
export const emptyList = (): ListTag => ({ type: "list", elementType: "end", value: [] });

export function isCompound(tag: NbtTag): tag is CompoundTag {
  return tag.type === "compound";
}

export function isList(tag: NbtTag): tag is ListTag {
  return tag.type === "list";
}
