"use client";

import { Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

export function KnowledgeSettingsTab() {
  const {
    loadSettings,
    settings,
    isLoadingSettings,
    isUpdatingSettings,
    updateSettings,
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
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [vectorEnabled, setVectorEnabled] = useState(false);
  const [vectorProvider, setVectorProvider] = useState("auto");
  const [vectorModel, setVectorModel] = useState("");

  const [graphEnabled, setGraphEnabled] = useState(false);
  const [graphExtractor, setGraphExtractor] = useState("llm");
  const [graphProvider, setGraphProvider] = useState("auto");
  const [graphModel, setGraphModel] = useState("");

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
    if (!kbDetail) return;
    setName(kbDetail.name ?? "");
    setDescription(kbDetail.description ?? "");
    setIcon(kbDetail.icon ?? "book");
    setVisibility((kbDetail.visibility ?? "private") as "private" | "team" | "public");
  }, [kbDetail]);

  useEffect(() => {
    if (!settings) return;
    setVectorEnabled(Boolean(settings.vectorization.enabled));
    setVectorProvider(settings.vectorization.provider || "auto");
    setVectorModel(settings.vectorization.model || "");

    setGraphEnabled(Boolean(settings.graph.enabled));
    setGraphExtractor(settings.graph.extractor || "llm");
    setGraphProvider(settings.graph.provider || "auto");
    setGraphModel(settings.graph.model || "");
  }, [settings]);

  if (!activeKbId) {
    return (
      <div className="rounded-xl border border-border-light p-lg text-sm text-text-tertiary">
        请先选择知识库。
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 space-y-lg overflow-auto pr-xs pb-md scrollbar-thin [overscroll-behavior:contain]">
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>删除知识库</DialogTitle>
          </DialogHeader>
          <div className="space-y-md text-sm">
            <p className="text-text-secondary">确定要删除知识库「{kbDetail?.name || "当前知识库"}」吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-sm">
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)} disabled={isDeletingKb}>
                取消
              </Button>
              <Button
                size="sm"
                className="bg-error text-white hover:bg-error/90"
                disabled={isDeletingKb}
                onClick={async () => {
                  if (!activeKbId) return;
                  await deleteKb(activeKbId);
                  setDeleteOpen(false);
                }}
              >
                {isDeletingKb ? "删除中..." : "确认删除"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border-light bg-background p-lg">
        <div className="mb-md text-sm font-semibold text-text-primary">知识库信息</div>
        <div className="grid gap-md md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-xs text-xs text-text-tertiary">名称</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <div className="mb-xs text-xs text-text-tertiary">描述</div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="可选"
            />
          </div>
          <div>
            <div className="mb-xs text-xs text-text-tertiary">图标</div>
            <select
              className="h-9 w-full rounded-md border border-border-light bg-white px-sm text-sm"
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
            <div className="mb-xs text-xs text-text-tertiary">权限</div>
            <select
              className="h-9 w-full rounded-md border border-border-light bg-white px-sm text-sm"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "private" | "team" | "public")}
            >
              <option value="private">仅自己</option>
              <option value="team">团队</option>
              <option value="public">公开</option>
            </select>
          </div>
        </div>

        {updateError && <div className="mt-sm text-xs text-error">{updateError}</div>}

        <div className="mt-md flex items-center justify-between border-t border-border-light pt-md">
          <Button
            size="sm"
            variant="outline"
            className="text-error border-error/30 hover:bg-error/10"
            disabled={isDeletingKb}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-xs h-3.5 w-3.5" />
            {isDeletingKb ? "删除中..." : "删除知识库"}
          </Button>
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
            {isUpdatingKb ? "保存中..." : "保存知识库"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border-light bg-background p-lg">
        <div className="mb-md flex items-center justify-between">
          <div className="text-sm font-semibold text-text-primary">向量与图谱</div>
          <Button
            size="sm"
            disabled={isLoadingSettings || isUpdatingSettings}
            onClick={async () => {
              setSettingsError(null);
              try {
                await updateSettings({
                  vectorization: {
                    enabled: vectorEnabled,
                    provider: vectorProvider,
                    model: vectorModel,
                  },
                  graph: {
                    enabled: graphEnabled,
                    extractor: graphExtractor,
                    provider: graphProvider,
                    model: graphModel,
                  },
                });
              } catch (error) {
                setSettingsError(error instanceof Error ? error.message : "设置保存失败");
              }
            }}
          >
            <Save className="mr-xs h-3.5 w-3.5" />
            {isUpdatingSettings ? "保存中..." : "保存设置"}
          </Button>
        </div>

        {isLoadingSettings ? (
          <div className="text-sm text-text-tertiary">加载向量/图谱设置中...</div>
        ) : !settings ? (
          <div className="text-sm text-text-tertiary">暂无向量/图谱设置数据。</div>
        ) : (
          <div className="grid gap-md md:grid-cols-2">
            <div className="rounded-lg border border-border-light p-md">
              <div className="mb-sm text-sm font-medium text-text-primary">向量化设置</div>
              <div className="space-y-sm">
                <label className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">启用向量化</span>
                  <input
                    type="checkbox"
                    checked={vectorEnabled}
                    onChange={(e) => setVectorEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                <div>
                  <div className="mb-xs text-xs text-text-tertiary">Provider</div>
                  <select
                    className="h-9 w-full rounded-md border border-border-light bg-white px-sm text-sm"
                    value={vectorProvider}
                    onChange={(e) => setVectorProvider(e.target.value)}
                  >
                    <option value="auto">auto</option>
                    <option value="openai">openai</option>
                    <option value="gemini">gemini</option>
                    <option value="local">local</option>
                  </select>
                </div>
                <div>
                  <div className="mb-xs text-xs text-text-tertiary">Model</div>
                  <Input value={vectorModel} onChange={(e) => setVectorModel(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border-light p-md">
              <div className="mb-sm text-sm font-medium text-text-primary">图谱设置</div>
              <div className="space-y-sm">
                <label className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">启用图谱</span>
                  <input
                    type="checkbox"
                    checked={graphEnabled}
                    onChange={(e) => setGraphEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
                <div>
                  <div className="mb-xs text-xs text-text-tertiary">Extractor</div>
                  <Input
                    value={graphExtractor}
                    onChange={(e) => setGraphExtractor(e.target.value)}
                  />
                </div>
                <div>
                  <div className="mb-xs text-xs text-text-tertiary">Provider</div>
                  <select
                    className="h-9 w-full rounded-md border border-border-light bg-white px-sm text-sm"
                    value={graphProvider}
                    onChange={(e) => setGraphProvider(e.target.value)}
                  >
                    <option value="auto">auto</option>
                    <option value="openai">openai</option>
                    <option value="gemini">gemini</option>
                    <option value="local">local</option>
                  </select>
                </div>
                <div>
                  <div className="mb-xs text-xs text-text-tertiary">Model</div>
                  <Input value={graphModel} onChange={(e) => setGraphModel(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {settingsError ? <div className="mt-sm text-xs text-error">{settingsError}</div> : null}
      </div>
    </div>
  );
}
