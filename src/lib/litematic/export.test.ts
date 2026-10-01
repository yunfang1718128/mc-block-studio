import { describe, expect, it } from "vitest";
import { sanitizeFilename } from "./export";

describe("sanitizeFilename", () => {
  it("appends the litematic suffix", () => {
    expect(sanitizeFilename("cat")).toBe("cat.litematic");
  });

  it("keeps an existing suffix without doubling it", () => {
    expect(sanitizeFilename("cat.litematic")).toBe("cat.litematic");
  });

  it("replaces characters that are illegal in filenames", () => {
    expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j')).toBe("a_b_c_d_e_f_g_h_i_j.litematic");
  });

  it("falls back when the name is empty or blank", () => {
    expect(sanitizeFilename("   ")).toBe("pixel-art.litematic");
  });
});
