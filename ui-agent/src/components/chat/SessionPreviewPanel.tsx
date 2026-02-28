"use client";

import { X, FileText } from "lucide-react";
import { useEffect } from "react";
import { DocPreview } from "@/components/knowledge/preview/DocPreview";
import type { KnowledgeDetail } from "@/services/knowledgeApi";
import { useSessionDocumentStore } from "@/stores/sessionDocumentStore";

interface SessionPreviewPanelProps {
  documentId: string | null;
  highlightPage?: number | null;
  highlightText?: string | null;
  onClose: () => void;
}

// 模拟 KnowledgeDetail 类型（实际应该从 API 获取）
function createMockDetail(documentId: string, highlightText?: string): KnowledgeDetail {
  return {
    id: documentId,
    filename: documentId,
    mimetype: "application/pdf",
    description: highlightText || "",
    tags: [],
    size: 0,
  };
}

export function SessionPreviewPanel({
  documentId,
  highlightPage,
  highlightText,
  onClose,
}: SessionPreviewPanelProps) {
  const { isPreviewOpen } = useSessionDocumentStore();

  if (!isPreviewOpen || !documentId) {
    return null;
  }

  // 创建一个模拟的 detail（实际应该从 API 获取）
  const detail = createMockDetail(documentId, highlightText || undefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[90vw] h-[90vh] bg-background rounded-lg flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-light">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span className="font-medium">文档预览</span>
            {highlightPage && (
              <span className="text-sm text-text-secondary">第 {highlightPage} 页</span>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-primary/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 预览内容 */}
        <div className="flex-1 overflow-hidden">
          <DocPreview detail={detail} highlightKeywords={highlightText ? [highlightText] : []} />
        </div>
      </div>
    </div>
  );
}
