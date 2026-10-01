import {
  TAG_END,
  tagTypeFromId,
  type CompoundTag,
  type ListTag,
  type NbtTag,
  type NbtTagType,
} from "./tags";

const textDecoder = new TextDecoder();

class ByteReader {
  private view: DataView;
  private bytes: Uint8Array;
  pos = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private need(n: number): void {
    if (this.pos + n > this.bytes.length) {
      throw new RangeError("Unexpected end of NBT stream");
    }
  }

  u8(): number {
    this.need(1);
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  i8(): number {
    this.need(1);
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return v;
  }

  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return v;
  }

  i64(): bigint {
    this.need(8);
    const v = this.view.getBigInt64(this.pos, false);
    this.pos += 8;
    return v;
  }

  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, false);
    this.pos += 4;
    return v;
  }

  f64(): number {
    this.need(8);
    const v = this.view.getFloat64(this.pos, false);
    this.pos += 8;
    return v;
  }

  raw(n: number): Uint8Array {
    this.need(n);
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
}

function readString(r: ByteReader): string {
  const length = r.u16();
  return textDecoder.decode(r.raw(length));
}

function readPayload(r: ByteReader, type: NbtTagType): NbtTag {
  switch (type) {
    case "byte":
      return { type: "byte", value: r.i8() };
    case "short":
      return { type: "short", value: r.i16() };
    case "int":
      return { type: "int", value: r.i32() };
    case "long":
      return { type: "long", value: r.i64() };
    case "float":
      return { type: "float", value: r.f32() };
    case "double":
      return { type: "double", value: r.f64() };
    case "byteArray": {
      const length = r.i32();
      return { type: "byteArray", value: new Int8Array(r.raw(length)) };
    }
    case "string":
      return { type: "string", value: readString(r) };
    case "intArray": {
      const length = r.i32();
      const value = new Int32Array(length);
      for (let i = 0; i < length; i++) value[i] = r.i32();
      return { type: "intArray", value };
    }
    case "longArray": {
      const length = r.i32();
      const value: bigint[] = new Array(length);
      for (let i = 0; i < length; i++) value[i] = r.i64();
      return { type: "longArray", value };
    }
    case "list": {
      const elementId = r.u8();
      const length = r.i32();
      const elementType = elementId === TAG_END ? "end" : tagTypeFromId(elementId);
      const value: NbtTag[] = [];
      for (let i = 0; i < length; i++) {
        value.push(readPayload(r, elementType as NbtTagType));
      }
      return { type: "list", elementType, value } satisfies ListTag;
    }
    case "compound": {
      const value: Record<string, NbtTag> = {};
      for (;;) {
        const childId = r.u8();
        if (childId === TAG_END) break;
        const name = readString(r);
        value[name] = readPayload(r, tagTypeFromId(childId));
      }
      return { type: "compound", value };
    }
  }
}

/** Parses a complete uncompressed NBT byte stream, returning the root name and tag. */
export function readNbt(bytes: Uint8Array): { name: string; tag: NbtTag } {
  const r = new ByteReader(bytes);
  const rootId = r.u8();
  const type = tagTypeFromId(rootId);
  const name = readString(r);
  const tag = readPayload(r, type);
  return { name, tag };
}

/** Parses a stream whose root is known to be a compound. */
export function readNbtCompound(bytes: Uint8Array): CompoundTag {
  const { tag } = readNbt(bytes);
  if (tag.type !== "compound") {
    throw new TypeError(`Expected root compound, got ${tag.type}`);
  }
  return tag;
}
