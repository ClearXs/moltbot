"use client";

import type { KnowledgeDocument } from "@/services/knowledgeApi";

interface KnowledgeCardProps {
  document?: KnowledgeDocument;
  onClick?: () => void;
}

export function KnowledgeCard({ document, onClick }: KnowledgeCardProps) {
  if (!document) return null;
  return (
    <button
      className="text-left rounded-xl border px-md py-sm transition-colors h-24 border-border-light bg-white hover:bg-primary/5 hover:border-primary/40"
      onClick={onClick}
    >
      <div className="text-sm font-medium truncate text-text-primary">{document.filename}</div>
      <div className="text-[11px] text-text-tertiary mt-1 truncate">
        {document.size ? `${(document.size / 1024).toFixed(1)} KB` : "未知大小"}
      </div>
      <div className="text-[10px] text-text-tertiary mt-2">
        {document.indexed ? "已索引" : "索引中"} · {(document.size / 1024).toFixed(1)} KB
      </div>
    </button>
  );
}
