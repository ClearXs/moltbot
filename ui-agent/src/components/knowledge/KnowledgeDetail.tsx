"use client";

import { useCallback, useState } from "react";
import { KnowledgeDocumentsTab } from "@/components/knowledge/tabs/KnowledgeDocumentsTab";
import { KnowledgeGraphTab } from "@/components/knowledge/tabs/KnowledgeGraphTab";
import { KnowledgeRetrievalTab } from "@/components/knowledge/tabs/KnowledgeRetrievalTab";
import { KnowledgeSettingsTab } from "@/components/knowledge/tabs/KnowledgeSettingsTab";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

type TabKey = "documents" | "graph" | "retrieval" | "settings";

interface KnowledgeDetailProps {
  activeDocumentId: string | null;
  onBack: () => void;
}

export function KnowledgeDetail({ activeDocumentId, onBack }: KnowledgeDetailProps) {
  const [tab, setTab] = useState<TabKey>("documents");
  const selectDocument = useKnowledgeBaseStore((state) => state.selectDocument);
  const kbDetail = useKnowledgeBaseStore((state) => state.kbDetail);

  const handleOpenDocument = useCallback(
    (documentId: string) => {
      void selectDocument(documentId);
      setTab("documents");
    },
    [selectDocument],
  );

  return (
    <div className="space-y-lg">
      <div className="flex items-center gap-md">
        <Button size="sm" variant="outline" onClick={onBack}>
          返回
        </Button>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text-primary truncate">
            {kbDetail?.name || "知识库"}
          </div>
          <div className="text-xs text-text-tertiary truncate">
            {kbDetail?.description || "管理该知识库的文档与检索设置"}
          </div>
        </div>
        <div className="flex items-center gap-sm text-sm">
          {(
            [
              { key: "documents", label: "文档" },
              { key: "graph", label: "图谱" },
              { key: "retrieval", label: "检索测试" },
              { key: "settings", label: "设置" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              className={cn(
                "px-sm py-xs rounded-full text-xs",
                tab === item.key
                  ? "bg-primary/10 text-primary"
                  : "bg-background-secondary text-text-tertiary",
              )}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "documents" && <KnowledgeDocumentsTab activeDocumentId={activeDocumentId} />}
      {tab === "graph" && <KnowledgeGraphTab />}
      {tab === "retrieval" && <KnowledgeRetrievalTab onOpenDocument={handleOpenDocument} />}
      {tab === "settings" && <KnowledgeSettingsTab />}
    </div>
  );
}
