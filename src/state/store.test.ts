import { beforeEach, describe, expect, it } from "vitest";
import { ORIENTATION_SENSITIVE_IDS, SOLID_BLOCKS } from "@/lib/blocks";
import { useStudio } from "./store";

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
