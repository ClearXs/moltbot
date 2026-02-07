"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

export function KnowledgeSettingsTab() {
  const {
    loadSettings,
    settings,
    isLoadingSettings,
    activeKbId,
    kbDetail,
    updateKb,
    isUpdatingKb,
    deleteKb,
    isDeletingKb,
  } = useKnowledgeBaseStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("book");
  const [visibility, setVisibility] = useState<"private" | "team" | "public">("private");
  const [updateError, setUpdateError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (kbDetail) {
      setName(kbDetail.name ?? "");
      setDescription(kbDetail.description ?? "");
      setIcon(kbDetail.icon ?? "book");
      setVisibility((kbDetail.visibility ?? "private") as typeof visibility);
    }
  }, [kbDetail]);

  if (!activeKbId) {
    return (
      <div className="rounded-xl border border-border-light p-lg text-sm text-text-tertiary">
        请先选择知识库。
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <div className="rounded-xl border border-border-light p-lg text-sm text-text-secondary space-y-md">
        <div className="text-xs text-text-tertiary">知识库信息</div>
        <div>
          <div className="text-xs text-text-tertiary mb-xs">名称</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="text-xs text-text-tertiary mb-xs">描述</div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="可选"
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
        {updateError && <div className="text-xs text-error">{updateError}</div>}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!name.trim() || isUpdatingKb}
            onClick={async () => {
              setUpdateError(null);
              try {
                await updateKb({
                  kbId: activeKbId,
                  name: name.trim(),
                  description: description.trim() || undefined,
                  icon,
                  visibility,
                });
              } catch (error) {
                setUpdateError(error instanceof Error ? error.message : "保存失败");
              }
            }}
          >
            {isUpdatingKb ? "保存中..." : "保存设置"}
          </Button>
        </div>
        <div className="pt-sm border-t border-border-light">
          <div className="text-xs text-text-tertiary mb-xs">危险操作</div>
          <Button
            size="sm"
            variant="outline"
            className="text-error border-error/30 hover:bg-error/10"
            disabled={isDeletingKb}
            onClick={() => {
              if (!activeKbId || !kbDetail?.name) return;
              if (!confirm(`确定要删除知识库「${kbDetail.name}」吗？此操作不可撤销。`)) {
                return;
              }
              void deleteKb(activeKbId);
            }}
          >
            <Trash2 className="w-3.5 h-3.5 mr-xs" />
            {isDeletingKb ? "删除中..." : "删除知识库"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border-light p-lg text-sm text-text-secondary space-y-md">
        {isLoadingSettings ? (
          <div className="text-sm text-text-tertiary">加载向量/图谱设置中...</div>
        ) : !settings ? (
          <div className="text-sm text-text-tertiary">暂无向量/图谱设置数据。</div>
        ) : (
          <>
            <div>
              <div className="text-xs text-text-tertiary mb-xs">向量化设置</div>
              <div className="flex items-center justify-between">
                <span>启用</span>
                <span className="text-text-primary">
                  {settings.vectorization.enabled ? "是" : "否"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Provider</span>
                <span className="text-text-primary">{settings.vectorization.provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Model</span>
                <span className="text-text-primary">{settings.vectorization.model}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-text-tertiary mb-xs">图谱设置</div>
              <div className="flex items-center justify-between">
                <span>启用</span>
                <span className="text-text-primary">{settings.graph.enabled ? "是" : "否"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Extractor</span>
                <span className="text-text-primary">{settings.graph.extractor}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Provider</span>
                <span className="text-text-primary">{settings.graph.provider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Model</span>
                <span className="text-text-primary">{settings.graph.model}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
