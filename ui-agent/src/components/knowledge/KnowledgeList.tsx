"use client";

import { KnowledgeCard } from "@/components/knowledge/KnowledgeCard";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

interface KnowledgeListProps {
  documentIds: string[];
  total: number;
  offset: number;
  limit: number;
  isLoading: boolean;
  onOpenDetail: (id: string) => void;
}

export function KnowledgeList({
  documentIds,
  total,
  offset,
  limit,
  isLoading,
  onOpenDetail,
}: KnowledgeListProps) {
  const { documentsById, loadDocuments } = useKnowledgeBaseStore();
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const isEmpty = !isLoading && total === 0;

  return (
    <div className="space-y-lg">
      {isEmpty ? (
        <div className="rounded-2xl border border-border-light bg-white p-2xl text-center">
          <div className="text-sm font-semibold text-text-primary">暂无文档</div>
          <div className="mt-xs text-xs text-text-tertiary">请上传文档或切换其他知识库</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
          {isLoading && documentIds.length === 0
            ? Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="h-24 rounded-xl border border-border-light bg-background-secondary/40 animate-pulse"
                />
              ))
            : documentIds.map((id) => (
                <KnowledgeCard
                  key={id}
                  document={documentsById[id]}
                  onClick={() => onOpenDetail(id)}
                />
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
              onClick={() => void loadDocuments({ offset: Math.max(0, offset - limit) })}
            >
              上一页
            </button>
            <span>
              {currentPage} / {totalPages}
            </span>
            <button
              className="px-sm py-xs rounded border border-border-light hover:bg-background-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => void loadDocuments({ offset: offset + limit })}
            >
              下一页
            </button>
            <select
              className="px-xs py-xs rounded border border-border-light bg-white text-xs"
              value={limit}
              onChange={(e) => void loadDocuments({ offset: 0, limit: Number(e.target.value) })}
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
