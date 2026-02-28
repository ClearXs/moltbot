"use client";

import { ArrowLeft, Save, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchScene, updateScene } from "@/features/scene/api/sceneApi";
import type { Scene } from "@/features/scene/types/scene";
import { useConnectionStore } from "@/stores/connectionStore";

// Dynamic import for SceneViewer to avoid SSR issues with @react-three/fiber
const SceneViewer = dynamic(
  () => import("@/components/scene/SceneViewer").then((mod) => mod.SceneViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

export default function SceneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wsClient = useConnectionStore((s) => s.wsClient);
  const sceneId = params.id as string;

  const [scene, setScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Scene>>({});
  const [sceneUrl, setSceneUrl] = useState<string | null>(null);

  // Build scene URL from r_path and main_file
  const getSceneUrl = (data: Partial<Scene>): string | null => {
    if (data.r_path && data.main_file) {
      return `${data.r_path}/${data.main_file}`;
    }
    return null;
  };

  // For now, use default agent
  const agentId = "default";

  // Load scene data
  useEffect(() => {
    if (!wsClient?.isConnected() || !sceneId) {
      setLoading(false);
      return;
    }

    loadScene();
  }, [wsClient, sceneId]);

  const loadScene = async () => {
    if (!wsClient) return;
    try {
      setLoading(true);
      const sceneData = await fetchScene(wsClient, agentId, sceneId);
      if (sceneData) {
        setScene(sceneData);
        setFormData(sceneData);
        setSceneUrl(getSceneUrl(sceneData));
      }
    } catch (error) {
      console.error("Failed to load scene:", error);
    } finally {
      setLoading(false);
    }
  };

  // Save scene config
  const handleSave = async () => {
    if (!wsClient || !sceneId) return;
    try {
      setSaving(true);
      await updateScene(wsClient, {
        agentId,
        sceneId,
        name: formData.name,
        description: formData.description,
        r_path: formData.r_path,
        main_file: formData.main_file,
        thumb: formData.thumb,
      });
      alert("保存成功");
    } catch (error) {
      console.error("Failed to save scene:", error);
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: keyof Scene, value: string) => {
    const newData = {
      ...formData,
      [field]: value,
    };
    setFormData(newData);
    // Update preview URL
    if (field === "r_path" || field === "main_file") {
      setSceneUrl(getSceneUrl(newData));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">{scene?.name || sceneId}</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          保存配置
        </Button>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Config Panel */}
        <div className="w-1/2 border-r overflow-auto">
          <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">基本信息</h2>

                <div className="space-y-2">
                  <label className="text-sm font-medium">名称</label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="场景名称"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">描述</label>
                  <textarea
                    value={formData.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                    placeholder="场景描述"
                  />
                </div>
              </div>

              {/* Scene Config */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">场景配置</h2>

                <div className="space-y-2">
                  <label className="text-sm font-medium">资源路径</label>
                  <input
                    type="text"
                    value={formData.r_path || ""}
                    onChange={(e) => handleFieldChange("r_path", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="/path/to/scene"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">主文件</label>
                  <input
                    type="text"
                    value={formData.main_file || ""}
                    onChange={(e) => handleFieldChange("main_file", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="scene.glb"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">缩略图路径</label>
                  <input
                    type="text"
                    value={formData.thumb || ""}
                    onChange={(e) => handleFieldChange("thumb", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="/path/to/thumb.png"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* 3D Preview Area */}
        <div className="w-1/2 bg-gray-100 flex flex-col">
          <SceneViewer modelUrl={sceneUrl} className="flex-1" />
          {/* Scene path display */}
          <div className="p-2 bg-gray-200 text-xs text-gray-600 truncate">
            {sceneUrl || "未配置场景模型"}
          </div>
        </div>
      </div>
    </div>
  );
}
