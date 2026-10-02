import { Boxes, ImageIcon, PawPrint } from "lucide-react";
import { useStudio, type Mode } from "@/state/store";
import { GenerationProvider } from "@/state/useGeneration";
import { PaletteTray } from "@/components/PaletteTray";
import { PreviewPanel } from "@/components/PreviewPanel";
import { ImportImageTab } from "@/components/ImportImageTab";
import { ImportMobTab } from "@/components/ImportMobTab";
import { PickBlockTab } from "@/components/PickBlockTab";
import { ExportBar } from "@/components/ExportBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function App() {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  const setViewMode = useStudio((s) => s.setViewMode);

  function onModeChange(value: string) {
    const next = value as Mode;
    setMode(next);
    if (next === "mob") setViewMode("3d");
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-3 border-b border-border bg-card px-4">
        <Boxes className="size-5 text-primary" />
        <h1 className="text-base font-semibold">MC Block Studio</h1>
        <span className="text-xs text-muted-foreground">图片 / 方块 → Minecraft 像素画</span>
      </header>

      <GenerationProvider>
        <div className="flex min-h-0 flex-1">
          <PaletteTray />

          <div className="flex min-w-0 flex-1 flex-col">
            <PreviewPanel />
            <ExportBar />
          </div>

          <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
            <Tabs value={mode} onValueChange={onModeChange} className="h-full">
              <TabsList className="m-3 grid grid-cols-3">
                <TabsTrigger value="image">
                  <ImageIcon />
                  导入图片
                </TabsTrigger>
                <TabsTrigger value="block">
                  <Boxes />
                  选择方块
                </TabsTrigger>
                <TabsTrigger value="mob">
                  <PawPrint />
                  导入生物
                </TabsTrigger>
              </TabsList>
              <TabsContent value="image" className="min-h-0 overflow-y-auto">
                <ImportImageTab />
              </TabsContent>
              <TabsContent value="block" className="flex min-h-0 flex-col overflow-hidden">
                <PickBlockTab />
              </TabsContent>
              <TabsContent value="mob" className="min-h-0 overflow-y-auto">
                <ImportMobTab />
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </GenerationProvider>
    </div>
  );
}
