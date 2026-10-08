import { useEffect, useMemo, useState } from "react";
import { nonAirCount, type VoxelModel } from "@/lib/voxel/model";
import type { CaptureInterior } from "@/lib/voxel/from-capture";
import { useDebouncedValue } from "@/state/useDebouncedValue";
import { FillerPicker } from "@/components/FillerPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/** Layout details reported by `buildCapture` for oversized captures. */
export interface CaptureOptionsInfo {
  downsample: number;
  nativeSize: [number, number, number];
  effectiveSize: [number, number, number];
}

export interface CaptureOptionsPanelProps {
  /** Slider bounds; the block tab spans a wider range than the mob tab. */
  magnificationMin?: number;
  magnificationMax?: number;
  magnification: number;
  onMagnification: (value: number) => void;
  interior: CaptureInterior;
  onInterior: (value: CaptureInterior) => void;
  cull: boolean;
  onCull: (value: boolean) => void;
  filler: string;
  onFiller: (id: string) => void;
  model: VoxelModel | null;
  captureInfo: CaptureOptionsInfo | null;
  error: string | null;
  /** Label DOM-id prefix, so two mounted panels never collide. */
  idPrefix: string;
}

/**
 * The controls shared by every `.mcvox` capture: how far to magnify it, whether
 * the interior is hollow or filled, whether hidden voxels are culled, and what
 * the resulting grid looks like. Both the mob tab and the block tab's upload
 * source drive `buildCapture` with exactly these options.
 */
export function CaptureOptionsPanel({
  magnificationMin = 1,
  magnificationMax = 8,
  magnification,
  onMagnification,
  interior,
  onInterior,
  cull,
  onCull,
  filler,
  onFiller,
  model,
  captureInfo,
  error,
  idPrefix,
}: CaptureOptionsPanelProps) {
  // Commit the magnification only once dragging stops so the model never
  // rebuilds mid-drag.
  const [magDraft, setMagDraft] = useState(magnification);
  useEffect(() => {
    setMagDraft(magnification);
  }, [magnification]);
  const debouncedMag = useDebouncedValue(magDraft, 200);
  useEffect(() => {
    if (debouncedMag !== magnification) onMagnification(debouncedMag);
  }, [debouncedMag, magnification, onMagnification]);

  const total = useMemo(() => (model ? nonAirCount(model) : 0), [model]);
  const magId = `${idPrefix}-magnification`;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={magId}>
          放大倍率：<span className="font-normal text-muted-foreground">{magDraft}×</span>
        </Label>
        <input
          id={magId}
          type="range"
          min={magnificationMin}
          max={magnificationMax}
          step={1}
          value={magDraft}
          onChange={(e) => setMagDraft(Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>内部处理</Label>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          <Button
            variant={interior === "hollow" ? "default" : "ghost"}
            size="sm"
            onClick={() => onInterior("hollow")}
          >
            空心
          </Button>
          <Button
            variant={interior === "fill" ? "default" : "ghost"}
            size="sm"
            onClick={() => onInterior("fill")}
          >
            填充
          </Button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={cull} onCheckedChange={(checked) => onCull(checked === true)} />
          剔除内部不可见方块
        </label>
      </div>

      {interior === "fill" && (
        <div className="flex flex-col gap-1.5">
          <Label>填充方块</Label>
          <FillerPicker value={filler} onChange={onFiller} />
        </div>
      )}

      <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        {model ? (
          <>
            <p>
              总体尺寸：
              <span className="font-medium text-foreground">
                {model.sizeX}×{model.sizeY}×{model.sizeZ}
              </span>
            </p>
            <p>
              共 <span className="font-medium text-foreground">{total}</span> 个方块
            </p>
            {captureInfo && captureInfo.downsample > 1 && (
              <p className="text-amber-600 dark:text-amber-500">
                体素过多，已按 1/{captureInfo.downsample} 分辨率预览（原始{" "}
                {captureInfo.nativeSize.join("×")} → {captureInfo.effectiveSize.join("×")}）
              </p>
            )}
          </>
        ) : (
          <p className="text-destructive">{error ?? "无法生成"}</p>
        )}
      </div>
    </>
  );
}
