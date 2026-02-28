"use client";

import type { VRM } from "@pixiv/three-vrm";
import { ArrowLeft, Save, Loader2, Settings, User } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchAgentIdentity,
  getAgentFile,
  setAgentFile,
} from "@/features/persona/services/personaApi";
import type { AgentInfo } from "@/features/persona/types/persona";
import { useConnectionStore } from "@/stores/connectionStore";

// Dynamic import for VrmViewer to avoid SSR issues with @react-three/fiber
const VrmViewer = dynamic(
  () => import("@/components/avatar/VrmViewer").then((mod) => mod.VrmViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    ),
  },
);

export default function PersonaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const wsClient = useConnectionStore((s) => s.wsClient);
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identityContent, setIdentityContent] = useState<Record<string, string>>({});
  const [currentVrm, setCurrentVrm] = useState<VRM | null>(null);
  const [vrmLoading, setVrmLoading] = useState(false);

  // Get VRM URL from identity config
  const vrmUrl = identityContent.vrm || null;

  // Handle VRM loaded
  const handleVrmLoad = useCallback((vrm: VRM) => {
    setCurrentVrm(vrm);
    setVrmLoading(false);
  }, []);

  // Reload VRM when URL changes
  useEffect(() => {
    if (vrmUrl) {
      setVrmLoading(true);
      setCurrentVrm(null);
    }
  }, [vrmUrl]);

  // Load agent data
  useEffect(() => {
    if (!wsClient?.isConnected() || !agentId) {
      setLoading(false);
      return;
    }

    loadAgentData();
  }, [wsClient, agentId]);

  const loadAgentData = async () => {
    if (!wsClient) return;
    try {
      setLoading(true);
      // Load agent identity
      const identity = await fetchAgentIdentity(wsClient, agentId);
      if (identity) {
        setAgent({ id: agentId, identity: identity as any });
      }

      // Load identity.json file content
      const fileResult = await getAgentFile(wsClient, agentId, ".identity.json");
      if (fileResult?.ok && fileResult.content) {
        try {
          setIdentityContent(JSON.parse(fileResult.content));
        } catch {
          // Ignore parse errors
        }
      }
    } catch (error) {
      console.error("Failed to load agent:", error);
    } finally {
      setLoading(false);
    }
  };

  // Save agent config
  const handleSave = async () => {
    if (!wsClient) return;
    try {
      setSaving(true);
      // Save identity.json
      await setAgentFile(
        wsClient,
        agentId,
        ".identity.json",
        JSON.stringify(identityContent, null, 2),
      );
      alert("保存成功");
    } catch (error) {
      console.error("Failed to save agent:", error);
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setIdentityContent((prev) => ({
      ...prev,
      [field]: value,
    }));
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
          <h1 className="text-xl font-semibold">
            {identityContent.name || agent?.identity?.name || "虚拟角色"}
          </h1>
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
              {/* Avatar Preview */}
              <div className="flex justify-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-bold">
                  {identityContent.name?.charAt?.(0) || agent?.identity?.name?.charAt(0) || "?"}
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  基本信息
                </h2>

                <div className="space-y-2">
                  <label className="text-sm font-medium">名称</label>
                  <input
                    type="text"
                    value={(identityContent.name as string) || ""}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="虚拟角色名称"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">描述</label>
                  <textarea
                    value={(identityContent.description as string) || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md min-h-[100px]"
                    placeholder="虚拟角色描述"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium"> Emoji</label>
                  <input
                    type="text"
                    value={(identityContent.emoji as string) || ""}
                    onChange={(e) => handleFieldChange("emoji", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="🎭"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">主题色</label>
                  <input
                    type="text"
                    value={(identityContent.theme as string) || ""}
                    onChange={(e) => handleFieldChange("theme", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="purple"
                  />
                </div>
              </div>

              {/* Avatar Config */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  虚拟形象配置
                </h2>

                <div className="space-y-2">
                  <label className="text-sm font-medium">VRM 模型路径</label>
                  <input
                    type="text"
                    value={(identityContent.vrm as string) || ""}
                    onChange={(e) => handleFieldChange("vrm", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="/path/to/model.vrm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">参考音频路径 (TTS)</label>
                  <input
                    type="text"
                    value={(identityContent.refAudio as string) || ""}
                    onChange={(e) => handleFieldChange("refAudio", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="/path/to/audio.wav"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">待机动画</label>
                  <input
                    type="text"
                    value={(identityContent.idleMotion as string) || ""}
                    onChange={(e) => handleFieldChange("idleMotion", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="idle_loop"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">语言</label>
                  <select
                    value={(identityContent.promptLang as string) || "zh"}
                    onChange={(e) => handleFieldChange("promptLang", e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="zh">中文</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* 3D Preview Area */}
        <div className="w-1/2 bg-gray-100 flex flex-col">
          <div className="flex-1 relative">
            {vrmLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            )}
            <VrmViewer modelUrl={vrmUrl} onVrmLoad={handleVrmLoad} />
          </div>
          {/* VRM Path display */}
          <div className="p-2 bg-gray-200 text-xs text-gray-600 truncate">
            {vrmUrl || "未配置 VRM 模型路径"}
          </div>
        </div>
      </div>
    </div>
  );
}
