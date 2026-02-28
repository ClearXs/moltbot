"use client";

import type { VRM } from "@pixiv/three-vrm";
import { GripVertical, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState, useRef, useCallback } from "react";
import Draggable from "react-draggable";

// Dynamic import for VrmViewer (SSR disabled)
const VrmViewer = dynamic(
  () => import("@/components/avatar/VrmViewer").then((mod) => mod.VrmViewer),
  { ssr: false },
);

interface DraggableVrmViewerProps {
  modelUrl: string | null;
  className?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function DraggableVrmViewer({
  modelUrl,
  className,
  onContextMenu,
}: DraggableVrmViewerProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // 默认位置：页面右下角
  const defaultPosition = { x: -320, y: -420 };

  const handleVrmLoad = useCallback(() => {
    setLoading(false);
  }, []);

  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={defaultPosition}
      bounds="parent"
      handle=".vrm-viewer-handle"
    >
      <div
        ref={nodeRef}
        className={`fixed z-30 flex flex-col ${className}`}
        style={{ width: 320 }}
        onContextMenu={onContextMenu}
      >
        {/* 拖动手柄 */}
        <div className="vrm-viewer-handle cursor-move bg-gray-800 text-white px-3 py-2 rounded-t-lg flex items-center justify-between select-none">
          <span className="text-sm font-medium">虚拟角色</span>
          <GripVertical className="w-4 h-4 opacity-60" />
        </div>
        {/* VRM 查看器 */}
        <div className="w-80 h-80 bg-gray-900 rounded-b-lg overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          )}
          <VrmViewer modelUrl={modelUrl} onVrmLoad={handleVrmLoad} />
        </div>
      </div>
    </Draggable>
  );
}

export default DraggableVrmViewer;
