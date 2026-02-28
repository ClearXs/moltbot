"use client";

import { Monitor, X } from "lucide-react";
import { FileItemProps } from "@/components/files/FileList";
import { cn } from "@/lib/utils";
import { FileListCompact } from "./FileListCompact";

interface ComputerPanelProps {
  files: FileItemProps[];
  isOpen: boolean;
  onClose: () => void;
  fullscreen?: boolean; // 移动端全屏模式
}

export function ComputerPanel({ files, isOpen, onClose, fullscreen = false }: ComputerPanelProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex flex-col",
        fullscreen
          ? "bg-surface border border-border shadow-lg h-full w-full"
          : "w-full max-h-[200px]",
      )}
    >
      {/* Panel Header - 仅全屏模式显示 */}
      {fullscreen && (
        <div className="flex items-center justify-between p-md border-b border-border flex-shrink-0 sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-sm">
            <Monitor className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-text-primary">Hovi's Computer</span>
            <span className="text-xs text-text-tertiary">已生成 {files.length} 个文件</span>
          </div>
          <button
            onClick={onClose}
            className="p-xs hover:bg-background-secondary rounded transition-colors"
            aria-label="关闭"
          >
            <X className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      )}

      {/* 分隔线 - 仅非全屏模式显示 */}
      {!fullscreen && <div className="border-t border-border" />}

      {/* File List */}
      <div className="flex-1 overflow-hidden">
        <FileListCompact files={files} />
      </div>
    </div>
  );
}
