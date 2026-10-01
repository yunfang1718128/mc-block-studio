/**
 * Download the textures referenced by `scripts/blocks.mjs` from Mojang's
 * bedrock-samples repository into `public/blocks/`.
 *
 *   node scripts/fetch-textures.mjs          # download missing files
 *   node scripts/fetch-textures.mjs --force  # re-download everything
 *
 * bedrock-samples is MIT licensed (see NOTICE).
 */

import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allTextureNames } from "./blocks.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "blocks");

const REPO = "Mojang/bedrock-samples";
const BRANCH = "main";
const PREFIX = "resource_pack/textures/blocks/";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PREFIX}`;

const FORCE = process.argv.includes("--force");
const CONCURRENCY = 16;

async function download(name) {
  const dest = path.join(OUT_DIR, `${name}.png`);
  if (!FORCE && existsSync(dest)) return "cached";

  const res = await fetch(`${RAW_BASE}${name}.png`, {
    headers: { "User-Agent": "mc-block-studio/0.1" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return "downloaded";
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const names = allTextureNames();
  console.log(`Fetching ${names.length} textures…`);

  const counts = { downloaded: 0, cached: 0, failed: 0 };
  const failures = [];
  let next = 0;

  async function worker() {
    while (next < names.length) {
      const name = names[next++];
      try {
        counts[await download(name)]++;
      } catch (err) {
        counts.failed++;
        failures.push(`${name}: ${err.message}`);
      }
      process.stdout.write(
        `\r  ${next}/${names.length} — downloaded ${counts.downloaded}, cached ${counts.cached}, failed ${counts.failed}   `
      );
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, names.length) }, worker)
  );

  console.log("\n");
  if (failures.length) {
    console.warn(`${failures.length} texture(s) unavailable:\n  ${failures.join("\n  ")}`);
    console.warn("Blocks missing a texture are skipped by build-block-data.mjs.");
  } else {
    console.log("All textures present.");
  }
}

main().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
