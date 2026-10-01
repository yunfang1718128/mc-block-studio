export type Rgb = [r: number, g: number, b: number];

/** The six directions a cube face can point in Minecraft's coordinate system. */
export type FaceDir = "north" | "south" | "east" | "west" | "top" | "bottom";

export const FACE_DIRS: readonly FaceDir[] = ["top", "bottom", "north", "south", "east", "west"];

/** The texture basename used for each of the six faces. */
export type BlockFaces = Record<FaceDir, string>;

/**
 * `solid`      — building blocks that participate in colour matching.
 * `functional` — chests, furnaces, ... available as replica sources only.
 */
export type BlockKind = "solid" | "functional";

export interface BlockInfo {
  id: string;
  name: string;
  category: string;
  kind: BlockKind;
  rgb: Rgb;
  variance: number;
  alpha: number;
  faces: BlockFaces;
}
