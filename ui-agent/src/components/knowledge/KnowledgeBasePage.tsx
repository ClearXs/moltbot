"use client";

import { useEffect, useMemo, useState } from "react";
import { KnowledgeBaseList } from "@/components/knowledge/KnowledgeBaseList";
import { KnowledgeDetail } from "@/components/knowledge/KnowledgeDetail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

export function KnowledgeBasePage() {
  const {
    loadKbList,
    kbIds,
    kbTotal,
    kbOffset,
    kbLimit,
    isLoadingKbList,
    selectKb,
    activeDocumentId,
    createKb,
    isCreatingKb,
  } = useKnowledgeBaseStore();
  const [view, setView] = useState<"list" | "detail">("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("book");
  const [visibility, setVisibility] = useState<"private" | "team" | "public">("private");
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "private" | "team" | "public">(
    "all",
  );

  useEffect(() => {
    void loadKbList({ offset: 0 });
  }, [loadKbList]);

  const handleOpenDetail = (kbId: string) => {
    void selectKb(kbId);
    setView("detail");
  };

  const iconOptions = useMemo(
    () => [
      { value: "book", label: "书籍" },
      { value: "database", label: "数据库" },
      { value: "folder", label: "文件夹" },
      { value: "lightbulb", label: "灵感" },
      { value: "shield", label: "合规" },
    ],
    [],
  );

  return (
    <div
      className={
        view === "list"
          ? "flex h-full min-h-0 flex-col p-2xl"
          : "flex h-full min-h-0 flex-col px-2xl pt-2xl pb-0"
      }
    >
      {view === "list" ? (
        <div className="space-y-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">知识库</h2>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              新建知识库
            </Button>
          </div>
          <div className="flex flex-col gap-sm md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 items-center gap-sm">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索知识库名称"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void loadKbList({
                      offset: 0,
                      search: search.trim() || undefined,
                      visibility: filterVisibility === "all" ? undefined : filterVisibility,
                    });
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void loadKbList({
                    offset: 0,
                    search: search.trim() || undefined,
                    visibility: filterVisibility === "all" ? undefined : filterVisibility,
                  })
                }
              >
                搜索
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setFilterVisibility("all");
                  void loadKbList({ offset: 0 });
                }}
              >
                清空
              </Button>
            </div>
            <div className="flex items-center gap-sm">
              <select
                className="h-9 rounded-md border border-border-light bg-white px-sm text-xs"
                value={filterVisibility}
                onChange={(e) => {
                  const value = e.target.value as typeof filterVisibility;
                  setFilterVisibility(value);
                  void loadKbList({
                    offset: 0,
                    search: search.trim() || undefined,
                    visibility: value === "all" ? undefined : value,
                  });
                }}
              >
                <option value="all">全部权限</option>
                <option value="private">仅自己</option>
                <option value="team">团队</option>
                <option value="public">公开</option>
              </select>
            </div>
          </div>
          <KnowledgeBaseList
            kbIds={kbIds}
            total={kbTotal}
            offset={kbOffset}
            limit={kbLimit}
            isLoading={isLoadingKbList}
            onOpenDetail={handleOpenDetail}
            onPageChange={(nextOffset) =>
              void loadKbList({
                offset: nextOffset,
                limit: kbLimit,
                search: search.trim() || undefined,
                visibility: filterVisibility === "all" ? undefined : filterVisibility,
              })
            }
            onLimitChange={(nextLimit) =>
              void loadKbList({
                offset: 0,
                limit: nextLimit,
                search: search.trim() || undefined,
                visibility: filterVisibility === "all" ? undefined : filterVisibility,
              })
            }
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <KnowledgeDetail
            activeDocumentId={activeDocumentId}
            onBack={() => {
              void selectKb(null);
              setView("list");
            }}
          />
        </div>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
          </DialogHeader>
          <div className="space-y-md text-sm">
            <div>
              <div className="text-xs text-text-tertiary mb-xs">名称</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：员工手册"
              />
            </div>
            <div>
              <div className="text-xs text-text-tertiary mb-xs">描述</div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选，用于说明知识库用途"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <div className="text-xs text-text-tertiary mb-xs">图标</div>
                <select
                  className="h-9 w-full rounded-md border border-border-light bg-white px-sm text-xs"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                >
                  {iconOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-text-tertiary mb-xs">权限</div>
                <select
                  className="h-9 w-full rounded-md border border-border-light bg-white px-sm text-xs"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                >
                  <option value="private">仅自己</option>
                  <option value="team">团队</option>
                  <option value="public">公开</option>
                </select>
              </div>
            </div>
            {createError && <div className="text-xs text-error">{createError}</div>}
            <div className="flex justify-end gap-sm">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateOpen(false)}
                disabled={isCreatingKb}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={!name.trim() || isCreatingKb}
                onClick={async () => {
                  setCreateError(null);
                  try {
                    await createKb({
                      name: name.trim(),
                      description: description.trim() || undefined,
                      icon,
                      visibility,
                    });
                    setCreateOpen(false);
                    setName("");
                    setDescription("");
                    setIcon("book");
                    setVisibility("private");
                  } catch (error) {
                    setCreateError(error instanceof Error ? error.message : "创建失败");
                  }
                }}
              >
                {isCreatingKb ? "创建中..." : "创建"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
