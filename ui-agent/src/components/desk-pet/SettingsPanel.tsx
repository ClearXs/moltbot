"use client";

import { Upload, Plus, Trash2, X, Edit, Play, Pause } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
// UI components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getAgentFile,
  setAgentFile,
  uploadAgentFile,
} from "@/features/persona/services/personaApi";
import { fetchScenes, createScene, updateScene, deleteScene } from "@/features/scene/api/sceneApi";
import type { Scene as ApiScene } from "@/features/scene/types/scene";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/connectionStore";

interface SettingsPanelProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSave?: () => void;
}

// 角色配置
interface PersonaConfig {
  vrm: string;
  refAudio: string;
  motions: string[]; // 已上传的动作列表
  currentMotion: string | null; // 当前选中的动作
  promptLang: string;
}

// 场景配置
interface LocalScene extends ApiScene {
  activated?: boolean;
}

export function SettingsPanel({ open, onOpenChange, onClose, onSave }: SettingsPanelProps) {
  const wsClient = useConnectionStore((s) => s.wsClient);

  const [loading, setLoading] = useState(true);
  const agentId = "main";
  const [personaConfig, setPersonaConfig] = useState<PersonaConfig>({
    vrm: "",
    refAudio: "",
    motions: [],
    currentMotion: null,
    promptLang: "zh",
  });
  const [scenes, setScenes] = useState<LocalScene[]>([]);
  const [currentSceneId, setCurrentSceneId] = useState<string | null>(null);
  const [soulContent, setSoulContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingVrm, setUploadingVrm] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 面板拖动状态
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const panelDragInfo = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const loadData = useCallback(async () => {
    if (!wsClient) return;
    setLoading(true);

    try {
      const fileResult = await getAgentFile(wsClient, agentId, "persona.json");
      if (fileResult?.content) {
        const content = fileResult.content.trim();
        // 检查是否是有效的 JSON 配置
        if (content.startsWith("{") && content.endsWith("}")) {
          try {
            const config = JSON.parse(content);
            // 支持 idleMotion (string) 或 motions (array)
            let motions: string[] = [];
            if (Array.isArray(config.motions)) {
              motions = config.motions;
            } else if (config.motions) {
              motions = [config.motions];
            } else if (config.idleMotion) {
              motions = [config.idleMotion];
            }
            // 当前选中的动作
            const currentMotion = config.currentMotion || (motions.length > 0 ? motions[0] : null);
            setPersonaConfig((prev) => ({
              ...prev,
              vrm: config.vrm || "",
              refAudio: config.refAudio || "",
              motions: motions,
              currentMotion: currentMotion,
            }));
          } catch (e) {
            console.error("Failed to parse persona.json as JSON:", e);
          }
        } else {
          console.log("persona.json is not JSON config, skipping");
        }
      }

      const soulResult = await getAgentFile(wsClient, agentId, "SOUL.md");
      if (soulResult?.content) {
        setSoulContent(soulResult.content);
      }

      const scenesData = await fetchScenes(wsClient, agentId);
      setScenes(scenesData);
      const activatedScene = scenesData.find((s: LocalScene) => s.activated);
      if (activatedScene) {
        setCurrentSceneId(activatedScene.id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [wsClient]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  const handleSave = async () => {
    if (!wsClient) return;
    setSaving(true);

    try {
      await setAgentFile(
        wsClient,
        agentId,
        "persona.json",
        JSON.stringify({
          vrm: personaConfig.vrm,
          refAudio: personaConfig.refAudio,
          motions: personaConfig.motions,
          currentMotion: personaConfig.currentMotion,
        }),
      );

      await setAgentFile(wsClient, agentId, "SOUL.md", soulContent);

      onSave?.();
      onClose?.();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleVrmUpload = async (file: File) => {
    console.log("VRM upload started:", file.name, "wsClient:", !!wsClient);
    if (!wsClient) {
      console.error("Missing wsClient");
      return;
    }
    setUploadingVrm(true);

    try {
      // 使用 FileReader 避免大文件栈溢出
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // 移除 data:application/octet-stream;base64, 前缀
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const fileName = `models/${file.name}`;
      console.log("Uploading VRM to:", fileName);
      const result = await uploadAgentFile(
        wsClient,
        agentId,
        fileName,
        base64,
        "model/gltf-binary",
      );
      console.log("VRM upload result:", result);

      setPersonaConfig((prev) => ({ ...prev, vrm: fileName }));
      console.log("Updated personaConfig.vrm to:", fileName);

      // 自动保存配置
      await setAgentFile(
        wsClient,
        agentId,
        "persona.json",
        JSON.stringify({
          vrm: fileName,
          refAudio: personaConfig.refAudio,
          motions: personaConfig.motions,
          currentMotion: personaConfig.currentMotion,
        }),
      );
      console.log("Auto-saved persona.json with VRM path");

      // 触发刷新回调，让页面重新加载 VRM
      onSave?.();
    } catch (error) {
      console.error("Failed to upload VRM:", error);
    } finally {
      setUploadingVrm(false);
    }
  };

  const handleAudioUpload = async (file: File) => {
    if (!wsClient) return;
    setUploadingAudio(true);

    try {
      // 使用 FileReader 避免大文件栈溢出
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const fileName = `audio/${file.name}`;
      const mimeType = file.name.endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
      await uploadAgentFile(wsClient, agentId, fileName, base64, mimeType);

      setPersonaConfig((prev) => ({ ...prev, refAudio: fileName }));
    } catch (error) {
      console.error("Failed to upload audio:", error);
    } finally {
      setUploadingAudio(false);
    }
  };

  const handleMotionUpload = async (file: File) => {
    if (!wsClient) return;

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const fileName = `motions/${file.name}`;
      await uploadAgentFile(wsClient, agentId, fileName, base64, "model/vmd");

      setPersonaConfig((prev) => ({
        ...prev,
        motions: [...prev.motions, fileName],
        currentMotion: fileName, // 自动选中刚上传的动作
      }));
    } catch (error) {
      console.error("Failed to upload motion:", error);
    }
  };

  const handleAddScene = async () => {
    if (!wsClient) return;
    try {
      const result = await createScene(wsClient, {
        agentId: agentId,
        name: `新场景 ${scenes.length + 1}`,
        description: "",
        r_path: "scenes/",
        main_file: "scene.json",
      });
      if (result.ok && result.scene) {
        setScenes([...scenes, { ...result.scene, activated: false }]);
      }
    } catch (error) {
      console.error("Failed to create scene:", error);
    }
  };

  const handleDeleteScene = async (sceneId: string) => {
    if (!wsClient) return;
    try {
      await deleteScene(wsClient, agentId, sceneId);
      setScenes(scenes.filter((s) => s.id !== sceneId));
    } catch (error) {
      console.error("Failed to delete scene:", error);
    }
  };

  const handleActivateScene = async (sceneId: string) => {
    if (!wsClient) return;
    try {
      const updatedScenes = scenes.map((s) => ({
        ...s,
        activated: s.id === sceneId,
      }));
      setScenes(updatedScenes);
      setCurrentSceneId(sceneId);

      await updateScene(wsClient, {
        agentId: agentId,
        sceneId,
      });
    } catch (error) {
      console.error("Failed to activate scene:", error);
    }
  };

  // 面板拖动处理
  const handlePanelDragStart = useCallback(
    (e: React.PointerEvent | React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const panel = panelRef.current;

      panelDragInfo.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: panelPosition?.x || 0,
        startPosY: panelPosition?.y || 0,
      };

      setIsDraggingPanel(true);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - panelDragInfo.current.startX;
        const deltaY = moveEvent.clientY - panelDragInfo.current.startY;

        // 限制范围在窗口内，允许超出但有限制
        if (panel) {
          const panelWidth = panel.offsetWidth;
          const panelHeight = panel.offsetHeight;
          const maxX = window.innerWidth - panelWidth / 2;
          const maxY = window.innerHeight - panelHeight / 2;
          const newX = Math.max(-maxX, Math.min(maxX, panelDragInfo.current.startPosX + deltaX));
          const newY = Math.max(-maxY, Math.min(maxY, panelDragInfo.current.startPosY + deltaY));
          setPanelPosition({ x: newX, y: newY });
        } else {
          setPanelPosition({
            x: panelDragInfo.current.startPosX + deltaX,
            y: panelDragInfo.current.startPosY + deltaY,
          });
        }
      };

      const handlePointerUp = () => {
        setIsDraggingPanel(false);
        document.removeEventListener("pointermove", handleMouseMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handleMouseMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [panelPosition],
  );

  if (!open) return null;

  return (
    <div className="w-full bg-background rounded-lg shadow-lg overflow-hidden flex flex-col">
      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 pointer-events-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : (
            <>
              {/* VRM 模型 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">VRM 模型</label>
                {personaConfig.vrm ? (
                  // 已上传 - 显示文件信息
                  <div className="flex items-center gap-2 p-2 border border-dashed rounded-md bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {personaConfig.vrm.split("/").pop()}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {personaConfig.vrm}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setPersonaConfig((p) => ({ ...p, vrm: "" }))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  // 未上传 - 显示上传按钮
                  <div className="flex gap-1">
                    <div className="flex-1 text-xs text-muted-foreground py-2">
                      点击右侧按钮上传 VRM 模型
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={uploadingVrm}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("Upload button clicked");
                        document.getElementById("vrm-upload-input")?.click();
                      }}
                    >
                      {uploadingVrm ? (
                        <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                    </Button>
                    <input
                      id="vrm-upload-input"
                      type="file"
                      accept=".vrm"
                      className="hidden"
                      onChange={(e) => {
                        console.log("File selected:", e.target.files);
                        const file = e.target.files?.[0];
                        if (file) handleVrmUpload(file);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 参考音频 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">参考音频</label>
                {personaConfig.refAudio ? (
                  // 已上传 - 显示文件信息
                  <div className="flex items-center gap-2 p-2 border border-dashed rounded-md bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {personaConfig.refAudio.split("/").pop()}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {personaConfig.refAudio}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setPersonaConfig((p) => ({ ...p, refAudio: "" }))}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  // 未上传 - 显示上传按钮
                  <div className="flex gap-1">
                    <div className="flex-1 text-xs text-muted-foreground py-2">
                      点击右侧按钮上传参考音频
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2"
                      disabled={uploadingAudio}
                      onClick={() => document.getElementById("audio-upload-input")?.click()}
                    >
                      {uploadingAudio ? (
                        <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-3 h-3" />
                      )}
                    </Button>
                    <input
                      id="audio-upload-input"
                      type="file"
                      accept=".wav,.mp3"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAudioUpload(file);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 动作列表 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">动作</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => document.getElementById("motion-upload-input")?.click()}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    添加
                  </Button>
                  <input
                    id="motion-upload-input"
                    type="file"
                    accept=".vmd,.vma,.vrma"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleMotionUpload(file);
                    }}
                  />
                </div>

                <div className="space-y-1 max-h-[100px] overflow-y-auto">
                  {personaConfig.motions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      暂无动作，点击添加
                    </p>
                  ) : (
                    personaConfig.motions.map((motion) => (
                      <div
                        key={motion}
                        className={`flex items-center justify-between p-1.5 border rounded-md text-xs cursor-pointer ${
                          personaConfig.currentMotion === motion
                            ? "border-primary bg-primary/10"
                            : "border-dashed hover:bg-muted/50"
                        }`}
                        onClick={() =>
                          setPersonaConfig((p) => ({
                            ...p,
                            currentMotion: motion,
                          }))
                        }
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <input
                            type="radio"
                            name="current-motion"
                            checked={personaConfig.currentMotion === motion}
                            onChange={() =>
                              setPersonaConfig((p) => ({
                                ...p,
                                currentMotion: motion,
                              }))
                            }
                            className="flex-shrink-0"
                          />
                          <span className="truncate">{motion.split("/").pop()}</span>
                          {personaConfig.currentMotion === motion && (
                            <span className="text-xs text-primary flex-shrink-0">(当前)</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPersonaConfig((p) => ({
                              ...p,
                              motions: p.motions.filter((m) => m !== motion),
                              currentMotion: p.currentMotion === motion ? null : p.currentMotion,
                            }));
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 语言 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">语言</label>
                <Select
                  value={personaConfig.promptLang}
                  onValueChange={(value) => setPersonaConfig((p) => ({ ...p, promptLang: value }))}
                >
                  <SelectTrigger className="h-8 text-xs w-full border-0">
                    <SelectValue placeholder="选择语言" />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={4}
                    className="z-[100] bg-white shadow-lg"
                  >
                    <SelectItem value="zh" className="text-xs">
                      中文
                    </SelectItem>
                    <SelectItem value="en" className="text-xs">
                      英文
                    </SelectItem>
                    <SelectItem value="ja" className="text-xs">
                      日文
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 场景配置 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">场景</label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={handleAddScene}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    添加
                  </Button>
                </div>

                <div className="space-y-1 max-h-[100px] overflow-y-auto">
                  {scenes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">暂无场景</p>
                  ) : (
                    scenes.map((scene) => (
                      <div
                        key={scene.id}
                        className={cn(
                          "flex items-center justify-between p-1.5 border rounded-md cursor-pointer text-xs",
                          scene.id === currentSceneId
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50",
                        )}
                        onClick={() => handleActivateScene(scene.id)}
                      >
                        <span className="truncate flex-1">{scene.name}</span>
                        <div className="flex items-center gap-1 ml-2">
                          {scene.activated ? (
                            <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                              激活
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteScene(scene.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Soul 配置 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Soul 配置</label>
                <Textarea
                  value={soulContent}
                  onChange={(e) => setSoulContent(e.target.value)}
                  placeholder="定义角色的性格、背景故事等..."
                  className="min-h-[80px] text-xs resize-none"
                />
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex justify-end p-3 shrink-0 bg-background">
        <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}

export default SettingsPanel;
