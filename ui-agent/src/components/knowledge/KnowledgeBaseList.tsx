"use client";

import { KnowledgeBaseCard } from "@/components/knowledge/KnowledgeBaseCard";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

interface KnowledgeBaseListProps {
  kbIds: string[];
  total: number;
  offset: number;
  limit: number;
  isLoading: boolean;
  onOpenDetail: (kbId: string) => void;
  onPageChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
}

export function KnowledgeBaseList({
  kbIds,
  total,
  offset,
  limit,
  isLoading,
  onOpenDetail,
  onPageChange,
  onLimitChange,
}: KnowledgeBaseListProps) {
  const { kbsById } = useKnowledgeBaseStore();
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isEmpty = !isLoading && total === 0;

  return (
    <div className="space-y-lg">
      {isEmpty ? (
        <div className="rounded-2xl border border-border-light bg-white p-2xl text-center">
          <div className="text-sm font-semibold text-text-primary">暂无知识库</div>
          <div className="mt-xs text-xs text-text-tertiary">
            还没有创建知识库，点击右上角“新建知识库”开始整理资料。
          </div>
          <div className="mt-xs text-xs text-text-tertiary">
            支持上传文档、图片、音频和视频，方便统一检索。
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {isLoading && kbIds.length === 0
            ? Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-28 rounded-xl border border-border-light bg-background-secondary/40 animate-pulse"
                />
              ))
            : kbIds.map((id) => (
                <KnowledgeBaseCard key={id} kb={kbsById[id]} onClick={() => onOpenDetail(id)} />
              ))}
        </div>
      )}

      {!isEmpty && (
        <div className="flex items-center justify-between text-xs text-text-tertiary">
          <div>共 {total} 条</div>
          <div className="flex items-center gap-sm">
            <button
              className="px-sm py-xs rounded border border-border-light hover:bg-background-secondary"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
            >
              上一页
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              className="px-sm py-xs rounded border border-border-light hover:bg-background-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(offset + limit)}
            >
              下一页
            </button>
            <select
              className="px-xs py-xs rounded border border-border-light bg-white text-xs"
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              {[10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  每页 {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
