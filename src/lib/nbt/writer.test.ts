import { describe, expect, it } from "vitest";
import { parse } from "prismarine-nbt";
import {
  byte,
  compound,
  emptyList,
  int,
  list,
  long,
  longArray,
  string,
  writeNbt,
} from "./index";
import { readNbtCompound } from "./reader";

interface LooseTag {
  type: string;
  value: unknown;
}

describe("writeNbt byte layout", () => {
  it("writes an empty-named compound root and big-endian ints", () => {
    const bytes = writeNbt(compound({ a: int(0x01020304) }));
    // root id(10) | name len(0) | child id(3) | name len(1) | 'a' | value | TAG_End
    expect(Array.from(bytes.slice(0, 7))).toEqual([0x0a, 0x00, 0x00, 0x03, 0x00, 0x01, 0x61]);
    expect(Array.from(bytes.slice(7, 11))).toEqual([0x01, 0x02, 0x03, 0x04]);
    expect(bytes[11]).toBe(0x00);
  });

  it("prefixes strings with a big-endian unsigned short byte length", () => {
    const bytes = writeNbt(compound({ s: string("abc") }));
    expect(bytes[3]).toBe(8);
    expect(bytes[4]).toBe(0x00);
    expect(bytes[5]).toBe(0x01);
    expect(bytes[6]).toBe(0x73); // 's'
    expect(bytes[7]).toBe(0x00);
    expect(bytes[8]).toBe(0x03);
    expect(Array.from(bytes.slice(9, 12))).toEqual([0x61, 0x62, 0x63]);
    expect(bytes[12]).toBe(0x00);
  });

  it("uses TAG_End as the element type of an empty list", () => {
    const bytes = writeNbt(compound({ l: emptyList() }));
    expect(bytes[3]).toBe(9);
    expect(bytes[7]).toBe(0x00); // element type
    expect(Array.from(bytes.slice(8, 12))).toEqual([0, 0, 0, 0]);
    expect(bytes[12]).toBe(0x00);
  });

  it("writes a byte tag with the same bit pattern as a signed int8", () => {
    const bytes = writeNbt(compound({ b: byte(-1) }));
    expect(bytes[7]).toBe(0xff);
  });
});

describe("writeNbt / readNbt round-trip", () => {
  it("recovers nested compounds, longs, arrays and lists", () => {
    const tree = compound({
      nested: compound({ n: long(-5n), flag: byte(1) }),
      names: list("string", [string("x"), string("y")]),
      longs: longArray([1n, -1n, 0n]),
      empties: emptyList(),
    });

    const decoded = readNbtCompound(writeNbt(tree));
    const nested = decoded.value.nested as { type: "compound"; value: Record<string, LooseTag> };
    expect(nested.value.n.value).toBe(-5n);
    expect(nested.value.flag.value).toBe(1);

    const names = decoded.value.names as { value: LooseTag[] };
    expect(names.value.map((t) => t.value)).toEqual(["x", "y"]);

    const longs = decoded.value.longs as { value: bigint[] };
    expect(longs.value).toEqual([1n, -1n, 0n]);

    const empties = decoded.value.empties as { elementType: string; value: unknown[] };
    expect(empties.elementType).toBe("end");
    expect(empties.value).toEqual([]);
  });
});

describe("prismarine-nbt agree on structure", () => {
  it("parses a compound our encoder wrote", async () => {
    const bytes = writeNbt(
      compound({
        num: int(1234),
        name: string("hi"),
        longs: longArray([1n, -1n]),
        empty: emptyList(),
        items: list("int", [int(1), int(2)]),
      }),
    );

    const { parsed } = await parse(Buffer.from(bytes));
    expect(parsed.name).toBe("");

    const root = parsed.value as unknown as Record<string, LooseTag>;
    expect((root.num.value as number)).toBe(1234);
    expect(root.name.value).toBe("hi");

    const longs = root.longs.value as Array<[number, number]>;
    expect(longs).toHaveLength(2);

    const empty = root.empty.value as { type: string; value: unknown[] };
    expect(empty.type).toBe("end");
    expect(empty.value).toHaveLength(0);

    // prismarine-nbt unwraps list elements to their raw values
    const items = root.items.value as { type: string; value: number[] };
    expect(items.value).toEqual([1, 2]);
  });
});
