import { describe, expect, it } from "vitest";
import { BLOCKS, BLOCKS_BY_ID, ORIENTATION_SENSITIVE_IDS } from "@/lib/blocks";

const WOOD_FOR_LOG: Readonly<Record<string, string>> = {
  oak_wood: "oak_log",
  spruce_wood: "spruce_log",
  birch_wood: "birch_log",
  jungle_wood: "jungle_log",
  acacia_wood: "acacia_log",
  dark_oak_wood: "dark_oak_log",
  cherry_wood: "cherry_log",
  mangrove_wood: "mangrove_log",
  "pale_oak_wood": "pale_oak_log",
  poplar_wood: "poplar_log",
};

describe("ORIENTATION_SENSITIVE_IDS", () => {
  it("lists only solid blocks with non-uniform faces", () => {
    for (const id of ORIENTATION_SENSITIVE_IDS) {
      const block = BLOCKS_BY_ID.get(id);
      expect(block, id).toBeDefined();
      expect(block!.kind, id).toBe("solid");
      expect(new Set(Object.values(block!.faces)).size, id).toBeGreaterThan(1);
    }
  });
});

describe("wood blocks (six-sided bark)", () => {
  for (const [wood, log] of Object.entries(WOOD_FOR_LOG)) {
    it(`${wood} reuses the log side texture on all six faces`, () => {
      const block = BLOCKS_BY_ID.get(wood);
      expect(block, wood).toBeDefined();
      const faceTextures = new Set(Object.values(block!.faces));
      expect(faceTextures.size, wood).toBe(1);
      expect([...faceTextures][0], wood).toBe(BLOCKS_BY_ID.get(log)!.faces.south);
    });

    it(`${wood} matches the palette before its log would change image-mode output`, () => {
      // Exact colour ties go to the earlier catalogue entry, so the wood must
      // sit after its log: image-mode results keep using the log unchanged.
      const woodBlock = BLOCKS_BY_ID.get(wood)!;
      const logBlock = BLOCKS_BY_ID.get(log)!;
      expect(woodBlock.rgb, wood).toEqual(logBlock.rgb);
      expect(BLOCKS.findIndex((b) => b.id === wood)).toBeGreaterThan(
        BLOCKS.findIndex((b) => b.id === log)
      );
    });
  }
});
