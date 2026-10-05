import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Layers, List } from "lucide-react";
import { loadTexture } from "@/lib/imaging/textureCache";
import type { FaceDir } from "@/lib/blocks/types";
import type { VoxelModel } from "@/lib/voxel/model";
import { groupVoxelsByBlock, textureNamesForGroups, type VoxelGroup } from "@/lib/voxel/instances";
import { useStudio } from "@/state/store";
import { cn } from "@/lib/utils";
import { MaterialsList } from "@/components/MaterialsList";

/**
 * BoxGeometry material-group order is +X, -X, +Y, -Y, +Z, -Z, so the cube's
 * six faces map to Minecraft's directions in exactly this order.
 */
const FACE_ORDER: readonly FaceDir[] = ["east", "west", "top", "bottom", "south", "north"];

interface Entry {
  mesh: THREE.InstancedMesh;
  group: VoxelGroup;
  geometry: THREE.BufferGeometry;
  materials: THREE.Material[];
  textures: THREE.Texture[];
}

interface Handles {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  root: THREE.Group;
  highlight: THREE.LineSegments;
  raycaster: THREE.Raycaster;
  ndc: THREE.Vector2;
  container: HTMLDivElement;
}

type SliceAxis = "x" | "y" | "z";
type SliceDirection = "below" | "above";

/** Size of the model along a slice axis. */
function axisSize(model: VoxelModel, axis: SliceAxis): number {
  return axis === "x" ? model.sizeX : axis === "z" ? model.sizeZ : model.sizeY;
}

interface ViewState {
  layer: number;
  axis: SliceAxis;
  direction: SliceDirection;
  solo: boolean;
  explode: number;
  centerY: number;
}

interface HoverInfo {
  name: string;
  x: number;
  y: number;
  z: number;
}

function disposeEntries(handles: Handles, entries: Entry[]): void {
  for (const entry of entries) {
    handles.root.remove(entry.mesh);
    entry.mesh.dispose();
    entry.geometry.dispose();
    for (const material of entry.materials) material.dispose();
    for (const texture of entry.textures) texture.dispose();
  }
}

function buildEntries(
  handles: Handles,
  groups: readonly VoxelGroup[],
  byName: Map<string, HTMLImageElement>
): Entry[] {
  const entries: Entry[] = [];
  for (const group of groups) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const textures: THREE.Texture[] = [];
    const materials = FACE_ORDER.map((dir) => {
      const image = byName.get(group.block.faces[dir]);
      if (!image) {
        const [r, g, b] = group.block.rgb;
        const color = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
        return new THREE.MeshLambertMaterial({ color });
      }
      const texture = new THREE.Texture(image);
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      textures.push(texture);
      return new THREE.MeshLambertMaterial({ map: texture });
    });

    const count = group.coords.length / 3;
    const mesh = new THREE.InstancedMesh(geometry, materials, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    handles.root.add(mesh);
    entries.push({ mesh, group, geometry, materials, textures });
  }
  return entries;
}

function frameCamera(handles: Handles, model: VoxelModel): void {
  const { camera, controls } = handles;
  const center = new THREE.Vector3(model.sizeX / 2, model.sizeY / 2, model.sizeZ / 2);
  const radius = 0.5 * Math.hypot(model.sizeX, model.sizeY, model.sizeZ);
  const fov = (camera.fov * Math.PI) / 180;
  const dist = (radius / Math.sin(fov / 2)) * 1.15;
  const direction = new THREE.Vector3(0.8, 0.65, 0.8).normalize();

  camera.position.copy(center).addScaledVector(direction, dist);
  camera.near = Math.max(0.1, dist - radius * 2);
  camera.far = dist + radius * 4;
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

/** Interactive three.js preview: orbit/zoom, layer slicing, explode and hover. */
export function Viewer3D({ model }: { model: VoxelModel }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<Handles | null>(null);
  const entriesRef = useRef<Entry[]>([]);
  const viewRef = useRef<ViewState>({
    layer: 0,
    axis: "y",
    direction: "below",
    solo: false,
    explode: 0,
    centerY: 0,
  });
  const setPreviewCanvas = useStudio((s) => s.setPreviewCanvas);

  const [layer, setLayer] = useState(model.sizeY - 1);
  const [axis, setAxis] = useState<SliceAxis>("y");
  const [direction, setDirection] = useState<SliceDirection>("below");
  const [solo, setSolo] = useState(false);
  const [explode, setExplode] = useState(0);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [showMaterials, setShowMaterials] = useState(true);

  const applyTransforms = useCallback(() => {
    const { layer: l, axis: ax, direction: dir, solo: s, explode: e, centerY } = viewRef.current;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const position = new THREE.Vector3();

    for (const entry of entriesRef.current) {
      const coords = entry.group.coords;
      let visible = 0;
      for (let i = 0; i < coords.length; i += 3) {
        const x = coords[i];
        const y = coords[i + 1];
        const z = coords[i + 2];
        const coord = ax === "x" ? x : ax === "z" ? z : y;
        if (s ? coord !== l : dir === "below" ? coord > l : coord < l) continue;
        position.set(x + 0.5, y + 0.5 + e * (y - centerY), z + 0.5);
        matrix.compose(position, quaternion, scale);
        entry.mesh.setMatrixAt(visible++, matrix);
      }
      entry.mesh.count = visible;
      entry.mesh.instanceMatrix.needsUpdate = true;
      entry.mesh.computeBoundingSphere();
    }

    const highlight = handlesRef.current?.highlight;
    if (highlight) highlight.visible = false;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.screenSpacePanning = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(1, 2, 1);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.25);
    fill.position.set(-1, 1, -1);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    const highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x22d3ee, depthTest: false, transparent: true })
    );
    highlight.visible = false;
    highlight.renderOrder = 999;
    scene.add(highlight);

    const handles: Handles = {
      renderer,
      scene,
      camera,
      controls,
      root,
      highlight,
      raycaster: new THREE.Raycaster(),
      ndc: new THREE.Vector2(),
      container,
    };
    handlesRef.current = handles;
    setPreviewCanvas(renderer.domElement);

    const clearHover = () => {
      highlight.visible = false;
      setHover(null);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      handles.ndc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      handles.raycaster.setFromCamera(handles.ndc, camera);
      const meshes = entriesRef.current.filter((e) => e.mesh.count > 0).map((e) => e.mesh);
      const hit = handles.raycaster.intersectObjects(meshes, false).find((h) => h.instanceId != null);
      const entry = hit ? entriesRef.current.find((e) => e.mesh === hit.object) : undefined;
      if (!hit || !entry || hit.instanceId == null) {
        clearHover();
        return;
      }
      const i = hit.instanceId * 3;
      const x = entry.group.coords[i];
      const y = entry.group.coords[i + 1];
      const z = entry.group.coords[i + 2];
      const { explode: e, centerY } = viewRef.current;
      highlight.position.set(x + 0.5, y + 0.5 + e * (y - centerY), z + 0.5);
      highlight.visible = true;
      setHover((prev) =>
        prev && prev.x === x && prev.y === y && prev.z === z ? prev : { name: entry.group.block.name, x, y, z }
      );
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", clearHover);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", clearHover);
      disposeEntries(handles, entriesRef.current);
      entriesRef.current = [];
      highlight.geometry.dispose();
      (highlight.material as THREE.Material).dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      handlesRef.current = null;
      setPreviewCanvas(null);
    };
  }, [setPreviewCanvas]);

  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;

    disposeEntries(handles, entriesRef.current);
    entriesRef.current = [];
    setReady(false);
    setHover(null);

    viewRef.current = {
      layer: model.sizeY - 1,
      axis: "y",
      direction: "below",
      solo: false,
      explode: 0,
      centerY: (model.sizeY - 1) / 2,
    };
    setLayer(model.sizeY - 1);
    setAxis("y");
    setDirection("below");
    setSolo(false);
    setExplode(0);
    frameCamera(handles, model);

    let cancelled = false;
    const groups = groupVoxelsByBlock(model);
    const names = textureNamesForGroups(groups);

    Promise.all(names.map(async (name) => [name, await loadTexture(name)] as const))
      .then((pairs) => {
        if (cancelled) return;
        entriesRef.current = buildEntries(handles, groups, new Map(pairs));
        applyTransforms();
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [model, applyTransforms]);

  useEffect(() => {
    viewRef.current.layer = layer;
    viewRef.current.axis = axis;
    viewRef.current.direction = direction;
    viewRef.current.solo = solo;
    viewRef.current.explode = explode;
    applyTransforms();
  }, [layer, axis, direction, solo, explode, applyTransforms]);

  const limit = axisSize(model, axis);
  const shownLayer = Math.min(layer, Math.max(0, limit - 1));

  const changeAxis = (next: SliceAxis) => {
    setAxis(next);
    setLayer(axisSize(model, next) - 1);
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} data-testid="viewer-3d" className="absolute inset-0" />

      {!ready && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/50">
          <p className="text-sm text-muted-foreground">正在加载 3D 模型…</p>
        </div>
      )}

      {hover && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/75 px-2 py-1 text-xs text-white shadow">
          {hover.name} · ({hover.x}, {hover.y}, {hover.z})
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowMaterials((value) => !value)}
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-gray-900 shadow ring-1 ring-gray-200 dark:bg-zinc-900/90 dark:text-zinc-100 dark:ring-zinc-700"
      >
        <List className="size-3.5" />
        材料
      </button>

      {showMaterials && (
        <div className="absolute right-3 top-12 bottom-20 w-52 overflow-hidden rounded-md bg-white/95 shadow-xl ring-1 ring-gray-200 dark:bg-zinc-900/95 dark:ring-zinc-700">
          <MaterialsList model={model} />
        </div>
      )}

      <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-4 rounded-md bg-white/90 px-3 py-2 text-xs shadow-xl ring-1 ring-gray-200 dark:bg-zinc-900/90 dark:ring-zinc-700">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5" />
          <span>分层</span>
          <div className="inline-flex overflow-hidden rounded-md ring-1 ring-gray-200 dark:ring-zinc-700">
            {(["x", "y", "z"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeAxis(value)}
                className={cn(
                  "px-2 py-0.5 font-medium uppercase transition-colors",
                  axis === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-transparent text-muted-foreground hover:bg-accent"
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, limit - 1)}
            value={shownLayer}
            disabled={limit <= 1}
            onChange={(event) => setLayer(Number(event.target.value))}
            className="w-28 accent-primary"
          />
          <span className="tabular-nums text-muted-foreground">
            {axis.toUpperCase()} {shownLayer + 1}/{limit}
          </span>
        </div>
        <div className="inline-flex overflow-hidden rounded-md ring-1 ring-gray-200 dark:ring-zinc-700">
          <button
            type="button"
            onClick={() => setDirection("below")}
            className={cn(
              "px-2 py-0.5 font-medium transition-colors",
              direction === "below"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-accent"
            )}
          >
            隐藏上半
          </button>
          <button
            type="button"
            onClick={() => setDirection("above")}
            className={cn(
              "px-2 py-0.5 font-medium transition-colors",
              direction === "above"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-accent"
            )}
          >
            隐藏下半
          </button>
        </div>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={solo}
            onChange={(event) => setSolo(event.target.checked)}
            className="accent-primary"
          />
          仅单层
        </label>
        <label className="flex items-center gap-2">
          <span>爆炸</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={explode}
            onChange={(event) => setExplode(Number(event.target.value))}
            className="w-28 accent-primary"
          />
          <span className="tabular-nums text-muted-foreground">{explode.toFixed(2)}</span>
        </label>
      </div>
    </div>
  );
}
