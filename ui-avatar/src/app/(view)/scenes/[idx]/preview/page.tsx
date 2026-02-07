"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import GltfPreviewer from "@/features/avatar/GltfPreviewer";
import { Viewer } from "@/features/avatar/vrm/viewer";
import { ViewerContext } from "@/features/avatar/vrm/viewerContext";
import VrmPreviewer from "@/features/avatar/VrmPreviewer";
import { buildFileUrl } from "@/services/gateway";
import { getDefaultAgentId } from "@/services/personas";
import useSceneApi, { Scene } from "@/services/scene";

const getFileExtension = (filename?: string) => {
  const match = filename?.toLowerCase().match(/\.[^/.]+$/);
  return match ? match[0] : "";
};

export default function ScenePreviewPage({ params }: { params: Promise<{ idx: string }> }) {
  const { idx } = use(params);
  const sceneApi = useSceneApi();
  const router = useRouter();

  const [scene, setScene] = useState<Scene>();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const viewer = useMemo(() => new Viewer(), []);

  useEffect(() => {
    return () => {
      viewer.unloadVRM();
    };
  }, [viewer]);

  useEffect(() => {
    const loadScene = async () => {
      try {
        setLoading(true);
        const resolvedAgentId = await getDefaultAgentId();
        const data = await sceneApi.getSceneById(idx);
        setScene(data);
        setAgentId(resolvedAgentId);
      } catch (error) {
        toast.error("加载场景失败");
        console.error("Failed to load scene", error);
      } finally {
        setLoading(false);
      }
    };
    void loadScene();
  }, [idx, sceneApi]);

  const resolveMainFilePath = (data: Scene) => {
    const base = data.r_path?.replace(/\/+$/, "") ?? "";
    if (!base) {
      return data.main_file;
    }
    return `${base}/${data.main_file}`;
  };

  const mainFileUrl = agentId && scene ? buildFileUrl(agentId, resolveMainFilePath(scene)) : null;
  const mainExt = getFileExtension(scene?.main_file);
  const isVrm = mainExt === ".vrm";
  const isGltf = mainExt === ".gltf" || mainExt === ".glb";

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <Button size="icon" variant="outline" onClick={() => router.back()}>
          <IconArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">场景预览</h1>
          <p className="text-sm text-gray-500">
            VRM/GLB/GLTF 支持内置预览，其他格式请下载后使用外部工具查看。
          </p>
        </div>
      </header>

      {loading ? (
        <Card>
          <Skeleton className="h-[480px] w-full rounded-lg" />
          <CardContent className="p-4">
            <Skeleton className="h-4 w-1/3" />
          </CardContent>
        </Card>
      ) : scene && mainFileUrl ? (
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">当前文件</div>
                <div className="text-base font-semibold text-gray-900">{scene.main_file}</div>
              </div>
              <Button asChild variant="outline">
                <a href={mainFileUrl} target="_blank" rel="noreferrer">
                  打开文件
                </a>
              </Button>
            </div>

            {isVrm ? (
              <div className="h-[520px] w-full rounded-lg overflow-hidden bg-black">
                <ViewerContext.Provider value={{ viewer }}>
                  <VrmPreviewer vrm={mainFileUrl} />
                </ViewerContext.Provider>
              </div>
            ) : isGltf ? (
              <div className="h-[520px] w-full rounded-lg overflow-hidden bg-black">
                <GltfPreviewer url={mainFileUrl} />
              </div>
            ) : (
              <div className="h-[520px] w-full rounded-lg border border-dashed flex items-center justify-center text-sm text-gray-500">
                当前格式暂不支持内置预览
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-sm text-gray-500">未找到可预览的资源</div>
      )}
    </div>
  );
}
