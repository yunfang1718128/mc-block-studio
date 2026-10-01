# MC Block Studio

把**图片**或**任意原版方块**转换成 Minecraft 像素画（体素建筑），提供 2D 方块展开图与 3D 预览，并导出 `.litematic` 投影文件。

- **导入图片**：照片 / 插画 → 像素画，可切换朝向。
- **选择方块**：选一个原版完整方块 → 生成中空放大的 3D 复刻（逐面贴图，最近邻采样保留原版像素风格）。

全部渲染与文件生成都在浏览器本地完成，**没有后端、不上传任何数据**。可离线使用。

## 下载 / 在线使用

- 网页版：<https://yunfang1718128.github.io/mc-block-studio/>
- Windows 桌面版（免费）：[Gitee Releases](https://gitee.com/yunfan1718128/mc-block-studio/releases/download/v0.1.0/MC%20Block%20Studio_0.1.0_x64-setup.exe)（国内高速） · [GitHub Releases](https://github.com/yunfang1718128/mc-block-studio/releases)

## 技术栈

Vite · React 19 · TypeScript · Tailwind CSS v4 · three.js · Zustand · pako · Tauri v2（桌面壳）

## 本地开发

```bash
pnpm install
pnpm dev          # 开发服务器 http://localhost:5173
pnpm test         # 单元测试（vitest）
pnpm typecheck    # tsc --noEmit
pnpm build        # 类型检查 + 生产构建
```

## 构建 Windows 桌面版

需要 Rust 工具链（含 MSVC）与系统 WebView2 运行时（Win10/11 已内置）。

```bash
pnpm desktop:dev     # 桌面开发模式
pnpm desktop:build   # 生成 NSIS 安装包，输出在 src-tauri/target/release/bundle/
```

## 数据来源

方块贴图与调色板由 `Mojang/bedrock-samples`（MIT）生成，见 [`NOTICE`](./NOTICE)。
重建目录：`pnpm fetch:blocks` + `pnpm build:blocks`。

## 许可证

GPL-2.0-only，见 [`LICENSE`](./LICENSE)。
