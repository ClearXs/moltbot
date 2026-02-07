"use client";

import { IconArrowLeft } from "@tabler/icons-react";
import { PlayCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildFileUrl } from "@/services/gateway";
import { getDefaultAgentId } from "@/services/personas";
import useSceneApi, { Scene, buildSceneThumbUrl } from "@/services/scene";

export default function SceneDetails({ params }: { params: Promise<{ idx: string }> }) {
  const { idx } = use(params);
  const sceneApi = useSceneApi();

  const router = useRouter();

  const [scene, setScene] = useState<Scene>();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
  const thumbUrl = agentId && scene ? buildSceneThumbUrl(agentId, scene) : null;
  const mainFileExt = scene?.main_file?.toLowerCase().split(".").pop();
  const isVrm = mainFileExt === "vrm";

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <Button size="icon" variant="outline" onClick={() => router.back()}>
          <IconArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">场景详情</h1>
          <p className="text-sm text-gray-500">查看场景文件与资源预览</p>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <Card>
            <Skeleton className="h-64 w-full rounded-t-lg" />
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : scene ? (
        <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <Card className="overflow-hidden">
            {thumbUrl ? (
              <img src={thumbUrl} alt={scene.name} className="h-64 w-full object-cover" />
            ) : (
              <div className="h-64 w-full bg-gray-100 flex items-center justify-center text-sm text-gray-400">
                暂无缩略图
              </div>
            )}
            <CardContent className="p-4 space-y-2">
              <h2 className="text-lg font-semibold text-gray-900">{scene.name}</h2>
              <p className="text-sm text-gray-500">{scene.description || "暂无描述"}</p>
              <p className="text-xs text-gray-400">主文件：{scene.main_file}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">场景主文件</p>
                {mainFileUrl ? (
                  <div className="flex flex-col gap-2">
                    <Button asChild variant="outline" className="w-full">
                      <a href={mainFileUrl} target="_blank" rel="noreferrer">
                        打开主文件
                      </a>
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => router.push(`/scenes/${idx}/preview`)}
                    >
                      <PlayCircle className="w-4 h-4" />
                      {isVrm ? "VRM 预览" : "场景预览"}
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">暂无主文件</div>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">缩略图文件</p>
                {thumbUrl ? (
                  <Button asChild variant="outline" className="w-full">
                    <a href={thumbUrl} target="_blank" rel="noreferrer">
                      查看缩略图
                    </a>
                  </Button>
                ) : (
                  <div className="text-sm text-gray-400">暂无缩略图</div>
                )}
              </div>

              <div className="text-xs text-gray-400 space-y-1">
                <div>路径：{scene.r_path || "未设置"}</div>
                <div>更新时间：{scene.updated_at}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-sm text-gray-500">未找到场景数据</div>
      )}
    </div>
  );
}
