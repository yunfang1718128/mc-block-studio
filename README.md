# mc-block-studio

A browser-based studio that turns images — or a single vanilla Minecraft block — into
pixel-art voxel builds, previews them in 3D, and exports them as `.litematic` schematics.

- **Tab 1 — Import image:** photograph/illustration → flat pixel art (orientation switchable).
- **Tab 2 — Pick a block:** a vanilla full block → a hollow, magnified 3D replica
  (per-face or uniform textures, nearest-neighbour to keep the vanilla pixel style).

All rendering and file generation happen client-side; there is no backend.

## Status

Early. Milestone **M0** only: project scaffold plus a from-scratch NBT encoder and
Litematica v6 encoder (with tests). The generator pipeline and UI land in M1–M3.

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · three.js/react-three-fiber · Zustand · pako

## Develop

```bash
pnpm install
pnpm dev          # dev server
pnpm test         # vitest (unit)
pnpm typecheck    # tsc --noEmit
pnpm build        # typecheck + production build
```

## License

GPL-2.0-only. See [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE). Block textures are
derived from [`Mojang/bedrock-samples`](https://github.com/Mojang/bedrock-samples) (MIT).
