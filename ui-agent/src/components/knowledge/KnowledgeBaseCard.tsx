"use client";

import { Book, Database, Folder, Lightbulb, Shield } from "lucide-react";
import type { KnowledgeBase } from "@/services/knowledgeApi";

interface KnowledgeBaseCardProps {
  kb?: KnowledgeBase;
  onClick?: () => void;
}

const iconMap = {
  book: Book,
  database: Database,
  folder: Folder,
  lightbulb: Lightbulb,
  shield: Shield,
} as const;

const visibilityLabel: Record<string, string> = {
  private: "仅自己",
  team: "团队",
  public: "公开",
};

export function KnowledgeBaseCard({ kb, onClick }: KnowledgeBaseCardProps) {
  if (!kb) return null;
  const Icon = (kb.icon && iconMap[kb.icon as keyof typeof iconMap]) || Book;
  const visibilityText = kb.visibility
    ? (visibilityLabel[kb.visibility] ?? kb.visibility)
    : "未设置权限";

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
      <div className="text-[10px] text-text-tertiary mt-2">
        更新于 {new Date(kb.updatedAt).toLocaleDateString("zh-CN")}
      </div>
    </button>
  );
}
