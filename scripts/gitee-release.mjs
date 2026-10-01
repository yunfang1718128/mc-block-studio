import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const token = process.env.GITEE_TOKEN;
const owner = process.env.GITEE_OWNER ?? "yunfan1718128";
const repo = process.env.GITEE_REPO ?? "mc-block-studio";
const tag = process.env.GITHUB_REF_NAME;

if (!token) throw new Error("missing GITEE_TOKEN");
if (!tag) throw new Error("missing GITHUB_REF_NAME");

const api = `https://gitee.com/api/v5/repos/${owner}/${repo}`;

const bundleDir = "src-tauri/target/release/bundle/nsis";
const version = tag.replace(/^v/, "");
const installers = readdirSync(bundleDir).filter((name) => name.endsWith("-setup.exe"));
const asset = installers.find((name) => name.includes(`_${version}_`)) ?? installers[0];
if (!asset) throw new Error(`no *-setup.exe found in ${bundleDir}`);
const file = readFileSync(join(bundleDir, asset));
console.log(`found installer ${asset} (${file.length} bytes)`);

async function readBody(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let release;
const existing = await fetch(`${api}/releases/tags/${tag}?access_token=${token}`);
const found = existing.ok ? await readBody(existing) : null;
if (found && found.id) {
  release = found;
  console.log(`release ${tag} already exists (id ${release.id})`);
} else {
  const created = await fetch(`${api}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      tag_name: tag,
      name: `MC Block Studio ${tag}`,
      body: [
        "图片 / 原版方块 → Minecraft 像素画，3D 预览并导出 `.litematic`。",
        "",
        `下载下方 \`${asset}\` 安装（Windows x64，免管理员）。`,
      ].join("\n"),
      target_commitish: "main",
      prerelease: false,
    }),
  });
  if (!created.ok) {
    throw new Error(`create release failed: ${created.status} ${JSON.stringify(await readBody(created))}`);
  }
  release = await readBody(created);
  console.log(`created release ${tag} (id ${release.id})`);
}

const form = new FormData();
form.append("access_token", token);
form.append("file", new Blob([file]), asset);

const uploaded = await fetch(`${api}/releases/${release.id}/attach_files`, {
  method: "POST",
  body: form,
});
if (!uploaded.ok) {
  throw new Error(`upload failed: ${uploaded.status} ${JSON.stringify(await readBody(uploaded))}`);
}
console.log(`uploaded ${asset} to Gitee release ${tag}`);
