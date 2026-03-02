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
  Volume2,
} from "lucide-react";
import dynamic from "next/dynamic";
import React, { useState, useCallback, useEffect, useRef } from "react";
import Draggable from "react-draggable";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useVoiceInput } from "@/features/avatar/hooks/useVoiceInput";
import { getAgentFile } from "@/features/persona/services/personaApi";
import { useConnectionStore } from "@/stores/connectionStore";

// 检查是否是 React 19 (存在兼容性问题)
const isReact19 = parseInt(React?.version?.split(".")[0] || "0", 10) >= 19;

// Dynamic import for VrmViewer - only load on client and not React 19
const VrmViewer = !isReact19
  ? dynamic(() => import("@/components/avatar/VrmViewer").then((mod) => mod.VrmViewer), {
      ssr: false,
      loading: () => (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          加载中...
        </div>
      ),
    })
  : null;

interface VirtualAssistantProps {
  onOpenSettings?: () => void;
}

export function VirtualAssistant({ onOpenSettings }: VirtualAssistantProps) {
  const wsClient = useConnectionStore((s) => s.wsClient);
  const status = useConnectionStore((s) => s.status);

  // 状态
  const [visible, setVisible] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [vrmUrl, setVrmUrl] = useState<string | null>(null);
  const [vrmError, setVrmError] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  // 语音输入
  const {
    status: voiceStatus,
    transcript,
    responseText,
    error: voiceError,
    toggle: handleToggleVoice,
  } = useVoiceInput({
    onStatusChange: (s) => console.log("[useVoiceInput] Status changed to:", s),
  });

  // 调试：确认组件渲染
  console.log("[VirtualAssistant] Render, voiceStatus:", voiceStatus);

  // 检查连接是否准备好
  const isConnected = status === "connected";

  // 加载 VRM 配置
  const loadConfig = useCallback(async () => {
    if (!wsClient || !isConnected || vrmError) return;
    try {
      const fileResult = await getAgentFile(wsClient, "main", "persona.json");
      if (fileResult?.ok && fileResult.content) {
        const config = JSON.parse(fileResult.content);
        if (config.vrm) {
          setVrmUrl(`/files/main/${config.vrm}`);
        }
      }
    } catch (error) {
      setVrmError(true);
    }
  }, [wsClient, isConnected, vrmError]);

  // 初始化时加载配置
  useEffect(() => {
    if (isConnected && !vrmError) {
      loadConfig();
    }
  }, [isConnected, vrmError, loadConfig]);

  // 右键菜单操作
  const handleToggleVisible = useCallback(() => {
    setVisible((v) => !v);
  }, []);

  const handleToggleMinimize = useCallback(() => {
    setMinimized((m) => !m);
  }, []);

  const handleToggleSubtitles = useCallback(() => {
    setShowSubtitles((s) => !s);
  }, []);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
  }, [onOpenSettings]);

  if (!visible) return null;

  // 测试按钮 - 用于验证点击事件
  const testButtonClick = () => {
    console.log("[TEST] Test button clicked!");
  };

  // 最小化状态的圆形按钮
  const renderMinimizedButton = () => (
    <div
      className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center shadow-lg cursor-pointer hover:bg-gray-700 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        console.log("[Voice] Minimized clicked, status:", voiceStatus);
        handleToggleVoice();
      }}
    >
      {voiceStatus === "speaking" ? (
        <Volume2 className="w-5 h-5 text-white" />
      ) : voiceStatus === "listening" ? (
        <Mic className="w-5 h-5 text-red-500 animate-pulse" />
      ) : (
        <MicOff className="w-5 h-5 text-white opacity-60" />
      )}
    </div>
  );

  // 正常状态的内容
  const renderExpandedContent = () => (
    <div className="w-80 flex flex-col">
      {/* 虚拟助手头部 - 单独处理，不被 ContextMenuTrigger 包裹 */}
      <div className="bg-gray-800 text-white px-3 py-2 rounded-t-lg flex items-center justify-between select-none">
        {/* 拖动区域 */}
        <span className="text-sm font-medium flex items-center gap-2 cursor-move va-handle">
          <GripVertical className="w-4 h-4 opacity-60" />
          虚拟角色
        </span>
        {/* 语音按钮 - 独立处理点击 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              console.log("[Voice] onMouseDown, status:", voiceStatus);
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log("[Voice] Button clicked, status:", voiceStatus);
              handleToggleVoice();
            }}
            className={`p-1 rounded hover:bg-gray-700 transition-colors ${
              voiceStatus === "listening" ? "bg-red-500 animate-pulse" : ""
            } ${voiceStatus === "speaking" ? "bg-blue-500" : ""}`}
            title={
              voiceStatus === "idle"
                ? "开始语音 (Ctrl+X)"
                : voiceStatus === "listening"
                  ? "停止语音"
                  : voiceStatus === "processing"
                    ? "处理中..."
                    : "播放中..."
            }
            disabled={voiceStatus === "processing"}
          >
            {voiceStatus === "speaking" ? (
              <Volume2 className="w-4 h-4" />
            ) : voiceStatus === "listening" ? (
              <Mic className="w-4 h-4" />
            ) : (
              <MicOff className="w-4 h-4 opacity-60" />
            )}
          </button>
        </div>
      </div>
      {/* VRM 区域 - 右键菜单区域 */}
      <ContextMenu>
        <ContextMenuTrigger>
          {/* VRM 显示区域 */}
          <div className="w-80 h-80 bg-gray-900 rounded-b-lg overflow-hidden relative">
            {isReact19 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <User className="w-12 h-12 mb-2 opacity-50" />
                <span className="text-sm">暂不支持 React 19</span>
              </div>
            ) : isConnected && !vrmError && VrmViewer ? (
              <VrmViewer modelUrl={vrmUrl} />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <User className="w-12 h-12 mb-2 opacity-50" />
                <span className="text-sm">{vrmError ? "加载失败" : "等待连接..."}</span>
              </div>
            )}
            {/* 字幕覆盖层 */}
            {showSubtitles && isConnected && !vrmError && (
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white text-sm text-center">
                  {voiceStatus === "listening"
                    ? transcript || "正在聆听..."
                    : voiceStatus === "processing"
                      ? "Hovi 思考中..."
                      : voiceStatus === "speaking"
                        ? responseText
                        : "点击麦克风或按 Ctrl+X 开始对话"}
                </p>
                {voiceError && (
                  <p className="text-red-400 text-xs text-center mt-1">{voiceError}</p>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={handleToggleVisible}>
            <Eye className="w-4 h-4 mr-2" />
            隐藏
          </ContextMenuItem>
          <ContextMenuItem onClick={handleToggleMinimize}>
            <Minimize2 className="w-4 h-4 mr-2" />
            最小化
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleToggleSubtitles}>
            <Subtitles className="w-4 h-4 mr-2" />
            {showSubtitles ? "隐藏字幕" : "显示字幕"}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleToggleVoice} disabled={voiceStatus === "processing"}>
            <Mic className="w-4 h-4 mr-2" />
            {voiceStatus === "listening" ? "停止语音" : "开始语音"}
            <span className="ml-auto text-xs text-gray-400">⌃X</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleOpenSettings}>
            <Settings className="w-4 h-4 mr-2" />
            设置
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );

  // 全局点击测试
  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".va-handle"
      cancel="button"
      bounds="parent"
      defaultPosition={{ x: -320, y: -420 }}
    >
      <div ref={nodeRef} className="fixed z-50">
        {minimized ? renderMinimizedButton() : renderExpandedContent()}
      </div>
    </Draggable>
  );
}

export default VirtualAssistant;
