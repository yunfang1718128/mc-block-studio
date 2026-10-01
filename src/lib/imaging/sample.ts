import type { Rgb } from "../blocks/types";

export type SampleAlgorithm = "nearest" | "average" | "median" | "lanczos" | "auto";

export interface ImageSource {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** A sampled cell: an RGB colour, or `null` for fully transparent (air). */
export type SampledColor = Rgb | null;

/** Below this mean alpha a cell is treated as transparent. */
const ALPHA_THRESHOLD = 32;

/** @internal RGBA channel planes, raw 0-255, row-major. */
type Channels = [Float32Array, Float32Array, Float32Array, Float32Array];

function toChannels(src: ImageSource): Channels {
  const n = src.width * src.height;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);
  const a = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const o = i * 4;
    r[i] = src.data[o];
    g[i] = src.data[o + 1];
    b[i] = src.data[o + 2];
    a[i] = src.data[o + 3];
  }
  return [r, g, b, a];
}

/**
 * Turn an averaged RGBA value into a palette colour, compositing partial
 * transparency onto neutral grey. Fully transparent cells become `null`.
 */
function finalize(r: number, g: number, b: number, a: number): SampledColor {
  if (a < ALPHA_THRESHOLD) return null;
  const af = a / 255;
  return [
    Math.round(r * af + 128 * (1 - af)),
    Math.round(g * af + 128 * (1 - af)),
    Math.round(b * af + 128 * (1 - af)),
  ];
}

/** Cell bounds for output pixel (ox, oy). */
function cellBounds(
  ox: number,
  oy: number,
  outW: number,
  outH: number,
  inW: number,
  inH: number
): [number, number, number, number] {
  const x0 = Math.floor((ox * inW) / outW);
  const x1 = Math.max(x0 + 1, Math.floor(((ox + 1) * inW) / outW));
  const y0 = Math.floor((oy * inH) / outH);
  const y1 = Math.max(y0 + 1, Math.floor(((oy + 1) * inH) / outH));
  return [Math.min(x0, inW - 1), Math.min(x1, inW), Math.min(y0, inH - 1), Math.min(y1, inH)];
}

function regionAverage(
  [cr, cg, cb, ca]: Channels,
  inW: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [number, number, number, number] {
  let r = 0, g = 0, b = 0, a = 0, count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * inW + x;
      r += cr[i]; g += cg[i]; b += cb[i]; a += ca[i];
      count++;
    }
  }
  return [r / count, g / count, b / count, a / count];
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const mid = values.length >> 1;
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

function regionMedian(
  [cr, cg, cb, ca]: Channels,
  inW: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): [number, number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [], as: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * inW + x;
      rs.push(cr[i]); gs.push(cg[i]); bs.push(cb[i]); as.push(ca[i]);
    }
  }
  return [median(rs), median(gs), median(bs), median(as)];
}

// ── Lanczos resampling (a = 3), separable ────────────────────────────────────

function lanczos(x: number, a = 3): number {
  if (x === 0) return 1;
  if (x <= -a || x >= a) return 0;
  const px = Math.PI * x;
  return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
}

function resampleLine(
  src: Float32Array,
  srcLen: number,
  dstLen: number,
  stride: number,
  offset: number,
  out: Float32Array,
  outOffset: number,
  outStride: number
): void {
  const ratio = srcLen / dstLen;
  const support = 3 * Math.max(1, ratio);

  for (let i = 0; i < dstLen; i++) {
    const center = (i + 0.5) * ratio - 0.5;
    const start = Math.max(0, Math.ceil(center - support));
    const end = Math.min(srcLen - 1, Math.floor(center + support));
    let sum = 0;
    let weight = 0;

    for (let j = start; j <= end; j++) {
      const w = lanczos((j - center) / Math.max(1, ratio));
      sum += src[j * stride + offset] * w;
      weight += w;
    }
    out[i * outStride + outOffset] = weight !== 0 ? sum / weight : src[offset];
  }
}

function lanczosResample(channels: Channels, inW: number, inH: number, outW: number, outH: number): Channels {
  const out: Channels = [
    new Float32Array(outW * outH),
    new Float32Array(outW * outH),
    new Float32Array(outW * outH),
    new Float32Array(outW * outH),
  ];
  const tmp: Channels = [
    new Float32Array(outW * inH),
    new Float32Array(outW * inH),
    new Float32Array(outW * inH),
    new Float32Array(outW * inH),
  ];

  for (let c = 0; c < 4; c++) {
    for (let y = 0; y < inH; y++) {
      resampleLine(channels[c], inW, outW, 1, y * inW, tmp[c], y * outW, 1);
    }
    for (let x = 0; x < outW; x++) {
      resampleLine(tmp[c], inH, outH, outW, x, out[c], x, outW);
    }
  }
  return out;
}

// ── Public samplers ──────────────────────────────────────────────────────────

export function sampleNearest(src: ImageSource, outW: number, outH: number): SampledColor[] {
  const channels = toChannels(src);
  const [cr, cg, cb, ca] = channels;
  const out: SampledColor[] = [];

  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      const [x0, , y0] = cellBounds(ox, oy, outW, outH, src.width, src.height);
      const cx = Math.min(x0, src.width - 1);
      const cy = Math.min(y0, src.height - 1);
      const i = cy * src.width + cx;
      out.push(finalize(cr[i], cg[i], cb[i], ca[i]));
    }
  }
  return out;
}

function sampleRegions(
  src: ImageSource,
  outW: number,
  outH: number,
  pick: (
    channels: Channels,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ) => [number, number, number, number]
): SampledColor[] {
  const channels = toChannels(src);
  const out: SampledColor[] = [];

  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++) {
      const [x0, x1, y0, y1] = cellBounds(ox, oy, outW, outH, src.width, src.height);
      const [r, g, b, a] = pick(channels, x0, y0, x1, y1);
      out.push(finalize(r, g, b, a));
    }
  }
  return out;
}

export function sampleAverage(src: ImageSource, outW: number, outH: number): SampledColor[] {
  return sampleRegions(src, outW, outH, (ch, x0, y0, x1, y1) =>
    regionAverage(ch, src.width, x0, y0, x1, y1)
  );
}

export function sampleMedian(src: ImageSource, outW: number, outH: number): SampledColor[] {
  return sampleRegions(src, outW, outH, (ch, x0, y0, x1, y1) =>
    regionMedian(ch, src.width, x0, y0, x1, y1)
  );
}

export function sampleLanczos(src: ImageSource, outW: number, outH: number): SampledColor[] {
  const channels = lanczosResample(toChannels(src), src.width, src.height, outW, outH);
  const out: SampledColor[] = [];
  for (let i = 0; i < outW * outH; i++) {
    out.push(finalize(channels[0][i], channels[1][i], channels[2][i], channels[3][i]));
  }
  return out;
}

export interface ComplexityReport {
  uniqueRatio: number;
  variance: number;
  edgeDensity: number;
  recommended: Exclude<SampleAlgorithm, "auto">;
}

/**
 * Inspect the source image and recommend a sampling algorithm.
 * - crisp, high-edge images (already pixel art) → nearest
 * - flat, low-variety images (logos, icons) → average
 * - smooth, photo-like images → lanczos
 * - everything else → median
 */
export function analyzeComplexity(src: ImageSource): ComplexityReport {
  const { width, height } = src;
  const pixels = width * height;
  const seen = new Set<number>();
  const luma = new Float32Array(pixels);

  let lSum = 0;
  let lSqSum = 0;

  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    if (src.data[o + 3] < 32) continue;
    const r = src.data[o], g = src.data[o + 1], b = src.data[o + 2];
    seen.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[i] = l;
    lSum += l;
    lSqSum += l * l;
  }

  const lMean = lSum / pixels;
  const lVar = Math.max(0, lSqSum / pixels - lMean * lMean);
  const variance = Math.min(1, lVar / (128 * 128));

  let edges = 0;
  let comparisons = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x + 1 < width) {
        comparisons++;
        if (Math.abs(luma[i] - luma[i + 1]) > 24) edges++;
      }
      if (y + 1 < height) {
        comparisons++;
        if (Math.abs(luma[i] - luma[i + width]) > 24) edges++;
      }
    }
  }

  const edgeDensity = comparisons ? edges / comparisons : 0;
  const uniqueRatio = seen.size / pixels;

  let recommended: Exclude<SampleAlgorithm, "auto">;
  if (edgeDensity > 0.18) {
    recommended = "nearest";
  } else if (variance < 0.02) {
    recommended = "average";
  } else if (edgeDensity < 0.06 && variance > 0.15) {
    recommended = "lanczos";
  } else {
    recommended = "median";
  }

  return { uniqueRatio, variance, edgeDensity, recommended };
}

/** Run the requested algorithm, resolving `"auto"` via the complexity report. */
export function sampleImage(
  src: ImageSource,
  outW: number,
  outH: number,
  algorithm: SampleAlgorithm
): SampledColor[] {
  const resolved = algorithm === "auto" ? analyzeComplexity(src).recommended : algorithm;
  switch (resolved) {
    case "nearest":
      return sampleNearest(src, outW, outH);
    case "average":
      return sampleAverage(src, outW, outH);
    case "median":
      return sampleMedian(src, outW, outH);
    case "lanczos":
      return sampleLanczos(src, outW, outH);
  }
}
