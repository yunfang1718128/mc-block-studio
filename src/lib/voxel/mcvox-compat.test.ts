// Guards the `.mcvox` container's forward/backward compatibility contract: the
// header is a length-prefixed JSON blob, so new optional keys must never affect
// the payload offset and must never break a reader that ignores them.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureSubject, encodeMcvox, parseMcvox, type McvoxCapture } from "./mcvox";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function makeCapture(): McvoxCapture {
  const occupancy = new Uint8Array(1);
  occupancy[0] = 0b1;
  const colors = new Uint8Array(4);
  colors[0] = 1;
  colors[1] = 2;
  colors[2] = 3;
  colors[3] = 255;
  return {
    header: {
      formatVersion: 1,
      entityId: "minecraft:probe",
      entityName: "Probe",
      mcVersion: "1.21.1",
      modLoader: "fabric",
      unitsPerBlock: 16,
      dimensions: [1, 1, 1],
      solid: true,
    },
    sizeX: 1,
    sizeY: 1,
    sizeZ: 1,
    occupancy,
    colors,
  };
}

/** Rewrite only the header JSON, leaving the payload bytes byte-identical. */
function rewriteHeader(bytes: Uint8Array, mutate: (h: Record<string, unknown>) => void): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerLength = view.getUint32(8, true);
  const header = JSON.parse(textDecoder.decode(bytes.subarray(12, 12 + headerLength)));
  mutate(header);
  const json = textEncoder.encode(JSON.stringify(header));
  const payload = bytes.subarray(12 + headerLength);
  const out = new Uint8Array(12 + json.length + payload.length);
  out.set(bytes.subarray(0, 12), 0);
  new DataView(out.buffer).setUint32(8, json.length, true);
  out.set(json, 12);
  out.set(payload, 12 + json.length);
  return out;
}

describe(".mcvox header compatibility", () => {
  it("reads a file that carries unknown additive header keys", () => {
    const bytes = rewriteHeader(encodeMcvox(makeCapture()), (h) => {
      h.subject = "block";
      h.blockState = "oak_stairs[facing=east,half=bottom,shape=straight]";
      h.somethingFromTheFuture = { nested: [1, 2, 3] };
    });
    const parsed = parseMcvox(bytes);
    expect(parsed.sizeX).toBe(1);
    expect(parsed.header.entityId).toBe("minecraft:probe");
    expect(parsed.header.subject).toBe("block");
    expect((parsed.header as unknown as Record<string, unknown>).somethingFromTheFuture).toEqual({
      nested: [1, 2, 3],
    });
  });

  it("keeps the payload byte-identical when only the header grows", () => {
    const original = encodeMcvox(makeCapture());
    const grown = rewriteHeader(original, (h) => {
      h.subject = "block";
    });
    const originalView = new DataView(original.buffer);
    const originalHeaderLength = originalView.getUint32(8, true);
    const originalPayload = original.subarray(12 + originalHeaderLength);
    const grownView = new DataView(grown.buffer);
    const grownHeaderLength = grownView.getUint32(8, true);
    const grownPayload = grown.subarray(12 + grownHeaderLength);
    expect(grownPayload.length).toBe(originalPayload.length);
    expect(Array.from(grownPayload)).toEqual(Array.from(originalPayload));
  });

  it("still reads every shipped entity-capture file", () => {
    const mobDir = join(dirname(fileURLToPath(import.meta.url)), "../../../public/mobs");
    const files = readdirSync(mobDir).filter((name) => name.endsWith(".mcvox"));
    expect(files.length).toBeGreaterThan(50);
    for (const name of files) {
      const parsed = parseMcvox(new Uint8Array(readFileSync(join(mobDir, name))));
      expect(parsed.header.entityId).toBeTruthy();
      expect(captureSubject(parsed.header)).toBe("entity");
      expect(parsed.sizeX * parsed.sizeY * parsed.sizeZ).toBeGreaterThan(0);
    }
  });
});
