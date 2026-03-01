"use client";

import {
  Eye,
  EyeOff,
  Minimize2,
  Maximize2,
  Subtitles,
  Settings,
  Mic,
  MicOff,
  GripVertical,
  User,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import dynamic from "next/dynamic";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { SettingsPanel } from "@/components/desk-pet/SettingsPanel";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { getAgentFile } from "@/features/persona/services/personaApi";
import { useConnectionStore } from "@/stores/connectionStore";

// Dynamic import for VrmViewer
const VrmViewer = dynamic(
  () => import("@/components/avatar/VrmViewer").then((mod) => mod.VrmViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center text-gray-400">加载中...</div>
    ),
  },
);

interface VirtualAssistantPageProps {
  onClose?: () => void;
}

export function VirtualAssistantPage({ onClose }: VirtualAssistantPageProps) {
  const wsClient = useConnectionStore((s) => s.wsClient);
  const status = useConnectionStore((s) => s.status);
  const AGENT_ID = "main";

  // 状态
  const [minimized, setMinimized] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [vrmUrl, setVrmUrl] = useState<string | null>(null);
  const [vrmLoading, setVrmLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [vrmError, setVrmError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // 按钮拖动状态
  const [btnPosition, setBtnPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingBtn, setIsDraggingBtn] = useState(false);
  const btnDragInfo = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const isConnected = status === "connected";

  // 加载 VRM 配置
  const loadConfig = useCallback(async () => {
    if (!wsClient || !isConnected) return;
    try {
      setVrmError(false);
      setVrmLoading(true);
      setVrmUrl(null);
      console.log("[VRM] Loading config for agent:", AGENT_ID);
      const fileResult = await getAgentFile(wsClient, AGENT_ID, "persona.json");
      console.log("[VRM] Config file result:", fileResult);

      // 检查文件是否存在且有内容
      const content = fileResult?.content;
      if (content) {
        const trimmed = content.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          try {
            const config = JSON.parse(trimmed);
            console.log("[VRM] Parsed config:", config, "vrm value:", config.vrm);
            if (config.vrm) {
              const url = `/files/${AGENT_ID}/${config.vrm}`;
              console.log("[VRM] Setting URL:", url);
              setVrmUrl(url);
            } else {
              console.log("[VRM] No vrm in config");
              setVrmLoading(false);
            }
          } catch (e) {
            console.error("[VRM] JSON parse error:", e);
            setVrmLoading(false);
          }
        } else {
          console.log("[VRM] persona.json is not valid JSON, skipping VRM load");
          setVrmLoading(false);
        }
      } else {
        console.log("[VRM] persona.json not found or empty, skipping VRM load");
        setVrmLoading(false);
      }
    } catch (error) {
      console.error("[VRM] Failed to load config:", error);
      setVrmError(true);
      setVrmLoading(false);
    }
  }, [wsClient, isConnected]);

  useEffect(() => {
    if (isConnected && !vrmError) {
      loadConfig();
    }
  }, [isConnected, vrmError, loadConfig]);

  // 右键菜单操作
  const handleToggleMinimize = useCallback(() => {
    setMinimized((m) => !m);
  }, []);

  const handleToggleSubtitles = useCallback(() => {
    setShowSubtitles((s) => !s);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleToggleVoice = useCallback(() => {
    setIsListening((l) => !l);
  }, []);

  // 按钮拖动处理
  const hasDragged = useRef(false);

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const btn = e.currentTarget.getBoundingClientRect();
      hasDragged.current = false;

      btnDragInfo.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: btnPosition?.x || 0,
        startPosY: btnPosition?.y || 0,
      };

      setIsDraggingBtn(true);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - btnDragInfo.current.startX;
        const deltaY = moveEvent.clientY - btnDragInfo.current.startY;

        // 记录是否发生了拖动
        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
          hasDragged.current = true;
        }

        // 限制范围在窗口内，允许超出但有限制
        const maxX = window.innerWidth - btn.width / 2;
        const maxY = window.innerHeight - btn.height / 2;
        const newX = Math.max(-maxX, Math.min(maxX, btnDragInfo.current.startPosX + deltaX));
        const newY = Math.max(-maxY, Math.min(maxY, btnDragInfo.current.startPosY + deltaY));
        setBtnPosition({ x: newX, y: newY });
      };

      const handlePointerUp = () => {
        setIsDraggingBtn(false);
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
      };

      document.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("pointerup", handlePointerUp);
    },
    [btnPosition],
  );

  // 检查是否是 React 19 - 暂时禁用检查，直接显示 VRM
  // const isReact19 = typeof window !== 'undefined' && parseInt(React?.version?.split('.')[0] || '0', 10) >= 19;

  return (
    <div className="w-full h-full relative">
      {/* VRM 显示区域 */}
      <div className="w-full h-full absolute inset-0">
        {vrmLoading ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
          </div>
        ) : isConnected && !vrmError ? (
          <VrmViewer modelUrl={vrmUrl} />
        ) : null}
      </div>

      {/* 右上角关闭按钮 */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full flex items-center justify-center bg-white/80 backdrop-blur-sm shadow-md cursor-pointer"
          title="返回"
        >
          <X className="w-5 h-5 text-gray-900" />
        </button>
      )}

      {/* 左侧顶部设置按钮 - 可拖动 */}
      <div
        className="absolute z-20"
        style={{
          top: btnPosition ? `calc(16px + ${btnPosition.y}px)` : "16px",
          left: btnPosition ? `calc(16px + ${btnPosition.x}px)` : "16px",
          transition: isDraggingBtn ? "none" : "all 0.2s ease",
        }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          onPointerDown={handleDragStart}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/80 backdrop-blur-sm shadow-md transition-colors cursor-pointer"
          title={isExpanded ? "角色设定" : "角色设定"}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-900" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-900" />
          )}
          <span className="text-sm font-medium text-gray-900">{"角色设定"}</span>
        </button>
      </div>

      {/* 设置面板 - 展开时显示在按钮下方 */}
      {isExpanded && (
        <div
          className="absolute z-20"
          style={{
            top: btnPosition ? `calc(60px + ${btnPosition.y}px)` : "60px",
            left: btnPosition ? `calc(16px + ${btnPosition.x}px)` : "16px",
          }}
        >
          <div className="bg-white rounded-lg shadow-lg w-[360px] isolation-auto">
            <SettingsPanel open={true} onClose={() => setIsExpanded(false)} onSave={loadConfig} />
          </div>
        </div>
      )}

      {/* 底部控制栏 + 状态信息 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        {/* 状态信息 */}
        {!isConnected && <span className="text-gray-600 text-sm">等待连接...</span>}
        {isConnected && vrmError && <span className="text-gray-600 text-sm">加载失败</span>}
        {/* 控制按钮 */}
        <div className="flex items-center gap-4 px-6 py-3 rounded-full">
          {/* 语音按钮 */}
          <button
            onClick={handleToggleVoice}
            className="p-2 rounded-full transition-colors cursor-pointer"
            title={isListening ? "停止语音" : "开始语音"}
          >
            {isListening ? (
              <Mic className="w-5 h-5 text-gray-900" />
            ) : (
              <MicOff className="w-5 h-5 text-gray-900 opacity-60" />
            )}
          </button>

          {/* 字幕按钮 */}
          <button
            onClick={handleToggleSubtitles}
            className="p-2 rounded-full transition-colors cursor-pointer"
            title={showSubtitles ? "隐藏字幕" : "显示字幕"}
          >
            <Subtitles
              className={`w-5 h-5 ${showSubtitles ? "text-gray-900" : "text-gray-900 opacity-60"}`}
            />
          </button>
        </div>
      </div>

      {/* 字幕覆盖层 */}
      {showSubtitles && isConnected && !vrmError && (
        <div className="absolute bottom-24 left-0 right-0 p-4 bg-gradient-to-t from-white/50 to-transparent z-10">
          <p className="text-gray-900 text-center text-lg">
            {isListening ? "正在聆听..." : "点击麦克风开始对话"}
          </p>
        </div>
      )}
    </div>
  );
}

export default VirtualAssistantPage;
