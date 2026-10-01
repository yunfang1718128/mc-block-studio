import { TAG_END, TAG_IDS, type CompoundTag, type NbtTag } from "./tags";

const textEncoder = new TextEncoder();

class ByteWriter {
  private buf: Uint8Array;
  private view: DataView;
  private pos = 0;

  constructor(initialCapacity = 4096) {
    this.buf = new Uint8Array(initialCapacity);
    this.view = new DataView(this.buf.buffer);
  }

  private ensure(extra: number): void {
    if (this.pos + extra <= this.buf.length) return;
    let next = this.buf.length * 2;
    while (next < this.pos + extra) next *= 2;
    const grown = new Uint8Array(next);
    grown.set(this.buf.subarray(0, this.pos));
    this.buf = grown;
    this.view = new DataView(grown.buffer);
  }

  u8(v: number): void {
    this.ensure(1);
    this.view.setUint8(this.pos, v & 0xff);
    this.pos += 1;
  }

  i16(v: number): void {
    this.ensure(2);
    this.view.setInt16(this.pos, v, false);
    this.pos += 2;
  }

  u16(v: number): void {
    this.ensure(2);
    this.view.setUint16(this.pos, v, false);
    this.pos += 2;
  }

  i32(v: number): void {
    this.ensure(4);
    this.view.setInt32(this.pos, v, false);
    this.pos += 4;
  }

  i64(v: bigint): void {
    this.ensure(8);
    this.view.setBigInt64(this.pos, BigInt.asIntN(64, v), false);
    this.pos += 8;
  }

  f32(v: number): void {
    this.ensure(4);
    this.view.setFloat32(this.pos, v, false);
    this.pos += 4;
  }

  f64(v: number): void {
    this.ensure(8);
    this.view.setFloat64(this.pos, v, false);
    this.pos += 8;
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    this.buf.set(bytes, this.pos);
    this.pos += bytes.length;
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.pos);
  }
}

function writeString(w: ByteWriter, value: string): void {
  const bytes = textEncoder.encode(value);
  if (bytes.length > 0xffff) {
    throw new RangeError(`NBT string too long: ${bytes.length} bytes`);
  }
  w.u16(bytes.length);
  w.raw(bytes);
}

function writePayload(w: ByteWriter, tag: NbtTag): void {
  switch (tag.type) {
    case "byte":
      w.u8(tag.value);
      return;
    case "short":
      w.i16(tag.value);
      return;
    case "int":
      w.i32(tag.value);
      return;
    case "long":
      w.i64(tag.value);
      return;
    case "float":
      w.f32(tag.value);
      return;
    case "double":
      w.f64(tag.value);
      return;
    case "byteArray":
      w.i32(tag.value.length);
      for (let i = 0; i < tag.value.length; i++) w.u8(tag.value[i]);
      return;
    case "string":
      writeString(w, tag.value);
      return;
    case "intArray":
      w.i32(tag.value.length);
      for (let i = 0; i < tag.value.length; i++) w.i32(tag.value[i]);
      return;
    case "longArray":
      w.i32(tag.value.length);
      for (let i = 0; i < tag.value.length; i++) w.i64(tag.value[i]);
      return;
    case "list": {
      const elementId = tag.elementType === "end" ? TAG_END : TAG_IDS[tag.elementType];
      w.u8(elementId);
      w.i32(tag.value.length);
      for (const element of tag.value) writePayload(w, element);
      return;
    }
    case "compound":
      for (const [name, child] of Object.entries(tag.value)) {
        w.u8(TAG_IDS[child.type]);
        writeString(w, name);
        writePayload(w, child);
      }
      w.u8(TAG_END);
      return;
  }
}

/**
 * Encodes a root compound into the uncompressed NBT byte stream.
 * The root tag is always a compound; `rootName` is virtually always empty.
 */
export function writeNbt(root: CompoundTag, rootName = ""): Uint8Array {
  const w = new ByteWriter();
  w.u8(TAG_IDS.compound);
  writeString(w, rootName);
  writePayload(w, root);
  return w.finish();
}
