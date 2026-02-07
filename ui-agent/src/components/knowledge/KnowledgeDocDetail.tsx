"use client";

import { useEffect, useRef } from "react";
import { DocPreview } from "@/components/knowledge/preview/DocPreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

interface KnowledgeDocDetailProps {
  documentId: string | null;
  onBack: () => void;
}

export function KnowledgeDocDetail({ documentId, onBack }: KnowledgeDocDetailProps) {
  const {
    detail,
    isLoadingDetail,
    selectDocument,
    loadChunks,
    chunkIds,
    chunksById,
    activeChunkId,
    selectChunk,
    isLoadingChunks,
    targetChunkId,
    searchHighlightKeywords,
    clearTargetChunk,
  } = useKnowledgeBaseStore();
  const chunkRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (documentId) {
      void selectDocument(documentId);
      void loadChunks(documentId, { offset: 0 });
    }
  }, [documentId, selectDocument, loadChunks]);

  useEffect(() => {
    if (!targetChunkId) return;
    const targetElement = chunkRefs.current[targetChunkId];
    if (!targetElement) return;

    selectChunk(targetChunkId);
    const scrollTimer = window.setTimeout(() => {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    const clearTimer = window.setTimeout(() => {
      clearTargetChunk();
    }, 1000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [targetChunkId, selectChunk, clearTargetChunk]);

  if (!documentId) {
    return <div className="text-sm text-text-tertiary">请选择文档</div>;
  }

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={onBack}>
          返回文档列表
        </Button>
      </div>

      {isLoadingDetail ? (
        <div className="h-64 rounded-xl border border-border-light bg-background-secondary/40 animate-pulse" />
      ) : (
        <div className="grid grid-cols-12 gap-md">
          <div className="col-span-4 rounded-xl border border-border-light p-md min-h-[420px]">
            <div className="text-xs text-text-tertiary mb-sm">分块列表</div>
            {isLoadingChunks ? (
              <div className="space-y-xs">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-border-light px-sm py-xs text-xs text-text-secondary animate-pulse"
                  >
                    Chunk {index + 1}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-xs max-h-[360px] overflow-auto pr-xs">
                {chunkIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => selectChunk(id)}
                    ref={(element) => {
                      chunkRefs.current[id] = element;
                    }}
                    className={cn(
                      "w-full rounded-md border px-sm py-xs text-left text-xs transition-colors",
                      activeChunkId === id
                        ? "border-primary/40 bg-primary/5 text-text-primary"
                        : "border-border-light text-text-secondary hover:bg-background-secondary",
                    )}
                  >
                    Chunk {chunksById[id]?.index ?? id}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="col-span-8 rounded-xl border border-border-light p-md min-h-[420px]">
            <div className="text-xs text-text-tertiary mb-sm">原始文件预览</div>
            <DocPreview detail={detail} highlightKeywords={searchHighlightKeywords} />
          </div>
        </div>
      )}
    </div>
  );
}
