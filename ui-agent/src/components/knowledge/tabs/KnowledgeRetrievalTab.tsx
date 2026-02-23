"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KnowledgeSearchResult } from "@/services/knowledgeApi";
import { knowledgeSearch } from "@/services/knowledgeApi";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";
import { useSessionStore } from "@/stores/sessionStore";

interface KnowledgeRetrievalTabProps {
  onOpenDocument?: (documentId: string) => void;
}

export function KnowledgeRetrievalTab({ onOpenDocument }: KnowledgeRetrievalTabProps) {
  const sessionKey = useSessionStore((state) => state.activeSessionKey);
  const activeKbId = useKnowledgeBaseStore((state) => state.activeKbId);
  const baseSettings = useKnowledgeBaseStore((state) => state.baseSettings);
  const setSearchResults = useKnowledgeBaseStore((state) => state.setSearchResults);
  const navigateToSearchResult = useKnowledgeBaseStore((state) => state.navigateToSearchResult);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(5);
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const effectiveLimit = baseSettings
    ? Math.max(1, Math.min(limit, baseSettings.retrieval.topK))
    : limit;

  if (!activeKbId) {
    return (
      <div className="rounded-xl border border-border-light p-lg text-sm text-text-tertiary">
        请先选择知识库。
      </div>
    );
  }

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError("请输入检索关键词");
      return;
    }
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const data = await knowledgeSearch({
        query: trimmed,
        limit: effectiveLimit,
        sessionKey: sessionKey ?? undefined,
        kbId: activeKbId,
      });
      const searchResults = data.results ?? [];
      setResults(searchResults);
      setSearchResults(searchResults, trimmed);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "检索失败");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-lg">
      <div className="rounded-xl border border-border-light p-lg">
        <div className="text-sm font-semibold text-text-primary mb-sm">检索测试</div>
        {baseSettings ? (
          <div className="mb-sm rounded-md border border-border-light bg-background-secondary px-sm py-xs text-[11px] text-text-secondary">
            生效参数：模式 {baseSettings.retrieval.mode} · TopK {baseSettings.retrieval.topK} ·
            最小分数 {baseSettings.retrieval.minScore}
            {baseSettings.retrieval.mode === "hybrid"
              ? ` · Hybrid Alpha ${baseSettings.retrieval.hybridAlpha}`
              : ""}
          </div>
        ) : null}
        <div className="flex flex-col gap-sm md:flex-row md:items-center">
          <div className="flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入检索问题或关键词"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
            />
          </div>
          <div className="flex items-center gap-sm">
            <select
              className="h-9 rounded-md border border-border-light bg-white px-sm text-xs"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[5, 10, 20, effectiveLimit]
                .filter((size) => !baseSettings || size <= baseSettings.retrieval.topK)
                .sort((a, b) => a - b)
                .filter((size, index, all) => all.indexOf(size) === index)
                .map((size) => (
                  <option key={size} value={size}>
                    {size} 条
                  </option>
                ))}
            </select>
            <Button size="sm" onClick={() => void handleSearch()} disabled={isLoading}>
              {isLoading ? "检索中..." : "开始检索"}
            </Button>
          </div>
        </div>
        {error && <div className="mt-sm text-xs text-error">{error}</div>}
      </div>

      <div className="space-y-sm">
        {isLoading && (
          <div className="rounded-xl border border-border-light p-md text-xs text-text-tertiary">
            正在检索知识库...
          </div>
        )}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="rounded-xl border border-border-light p-md text-xs text-text-tertiary">
            未找到匹配结果，可尝试更换关键词。
          </div>
        )}
        {!isLoading &&
          results.map((result, index) => (
            <div
              key={`${result.documentId}-${result.chunkId ?? index}`}
              className="rounded-xl border border-border-light p-md bg-white"
            >
              <div className="flex items-start justify-between gap-md">
                <div>
                  <div className="text-sm font-medium text-text-primary">{result.filename}</div>
                  <div className="text-xs text-text-tertiary mt-xs">
                    相关度 {typeof result.score === "number" ? result.score.toFixed(3) : "-"}
                    {result.lines ? ` · 行号 ${result.lines}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigateToSearchResult(result);
                    onOpenDocument?.(result.documentId);
                  }}
                >
                  查看文档
                </Button>
              </div>
              <div className="mt-sm text-xs text-text-secondary whitespace-pre-wrap">
                {result.snippet || "无摘要"}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
