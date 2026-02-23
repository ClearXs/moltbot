"use client";

import { getKnowledgeIconOption } from "@/components/knowledge/iconRegistry";
import type { KnowledgeBase } from "@/services/knowledgeApi";

interface KnowledgeBaseCardProps {
  kb?: KnowledgeBase;
  onClick?: () => void;
}

const visibilityLabel: Record<string, string> = {
  private: "仅自己",
  team: "团队",
  public: "公开",
};

export function KnowledgeBaseCard({ kb, onClick }: KnowledgeBaseCardProps) {
  if (!kb) return null;
  const iconOption = getKnowledgeIconOption(kb.icon);
  const Icon = iconOption.Icon;
  const visibilityText = kb.visibility
    ? (visibilityLabel[kb.visibility] ?? kb.visibility)
    : "未设置权限";
  const createdText = kb.createdAt ? new Date(kb.createdAt).toLocaleDateString("zh-CN") : "未知";
  const documentCount = kb.documentCount ?? 0;

  return (
    <button
      className="text-left rounded-xl border px-md py-sm transition-colors h-28 border-border-light bg-white hover:bg-primary/5 hover:border-primary/40"
      onClick={onClick}
    >
      <div className="flex items-center gap-sm">
        <div className="h-8 w-8 rounded-lg bg-background-secondary flex items-center justify-center text-sm text-text-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate text-text-primary">{kb.name}</div>
          <div className="text-[11px] text-text-tertiary mt-0.5 truncate">
            权限：{visibilityText}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-text-secondary mt-2 line-clamp-2">
        {kb.description || "暂无描述"}
      </div>
      <div className="mt-2 flex items-center gap-sm text-[10px] text-text-tertiary">
        <span>文档 {documentCount}</span>
        <span>创建于 {createdText}</span>
      </div>
    </button>
  );
}
