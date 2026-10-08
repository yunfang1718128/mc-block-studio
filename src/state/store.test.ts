import { beforeEach, describe, expect, it } from "vitest";
import { ORIENTATION_SENSITIVE_IDS, SOLID_BLOCKS } from "@/lib/blocks";
import { useStudio } from "./store";
import type { McvoxCapture } from "@/lib/voxel/mcvox";

function makeCapture(id: string): McvoxCapture {
  return {
    header: {
      formatVersion: 1,
      entityId: id,
      entityName: "橡木楼梯",
      mcVersion: "1.21.1",
      modLoader: "fabric",
      unitsPerBlock: 16,
      dimensions: [16, 16, 16],
      solid: true,
      subject: "block",
      blockState: "oak_stairs[facing=east,half=bottom,shape=straight]",
    },
    sizeX: 16,
    sizeY: 16,
    sizeZ: 16,
    occupancy: new Uint8Array(Math.ceil((16 * 16 * 16) / 8)),
    colors: new Uint8Array(16 * 16 * 16 * 4),
  };
}

describe("filterOrientationSensitive", () => {
  beforeEach(() => {
    useStudio.setState({ allowed: new Set(SOLID_BLOCKS.map((b) => b.id)) });
  });

  it("unchecks exactly the orientation-sensitive blocks", () => {
    useStudio.getState().filterOrientationSensitive();
    const allowed = useStudio.getState().allowed;
    for (const id of ORIENTATION_SENSITIVE_IDS) expect(allowed.has(id)).toBe(false);
    expect(allowed.has("oak_planks")).toBe(true);
    expect(allowed.has("white_wool")).toBe(true);
    expect(allowed.size).toBe(SOLID_BLOCKS.length - ORIENTATION_SENSITIVE_IDS.size);
  });

  it("leaves every other selection untouched", () => {
    useStudio.setState({ allowed: new Set(["oak_log", "oak_planks"]) });
    useStudio.getState().filterOrientationSensitive();
    const allowed = useStudio.getState().allowed;
    expect(allowed.has("oak_log")).toBe(false);
    expect(allowed.has("oak_planks")).toBe(true);
  });
});

describe("block tab upload state", () => {
  beforeEach(() => {
    useStudio.setState({
      blockSource: "builtin",
      blockCapture: null,
      blockCaptureName: "",
      blockMagnification: 2,
      blockInterior: "hollow",
      blockCull: true,
      blockFiller: "stone",
      // The mob tab owns its own copy; make sure the block tab never writes it.
      capture: null,
      captureName: "",
    });
  });

  it("starts on the built-in source with block-friendly capture defaults", () => {
    const state = useStudio.getState();
    expect(state.blockSource).toBe("builtin");
    expect(state.blockCapture).toBeNull();
    expect(state.blockInterior).toBe("hollow");
    expect(state.blockCull).toBe(true);
    expect(state.blockFiller).toBe("stone");
  });

  it("stores a block capture together with its file name", () => {
    const capture = makeCapture("minecraft:oak_stairs");
    useStudio.getState().setBlockCapture(capture, "oak_stairs.mcvox");
    expect(useStudio.getState().blockCapture).toBe(capture);
    expect(useStudio.getState().blockCaptureName).toBe("oak_stairs.mcvox");
  });

  it("drops the stale file name when a capture is cleared", () => {
    useStudio.getState().setBlockCapture(makeCapture("minecraft:oak_stairs"), "a.mcvox");
    useStudio.getState().setBlockCapture(null);
    expect(useStudio.getState().blockCapture).toBeNull();
    expect(useStudio.getState().blockCaptureName).toBe("");
  });

  it("keeps the block tab's capture separate from the mob tab's", () => {
    useStudio.getState().setBlockCapture(makeCapture("minecraft:oak_stairs"), "block.mcvox");
    expect(useStudio.getState().capture).toBeNull();
    expect(useStudio.getState().captureName).toBe("");
  });
});
