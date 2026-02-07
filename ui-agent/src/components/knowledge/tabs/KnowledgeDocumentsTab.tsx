"use client";

import { useEffect, useState } from "react";
import { KnowledgeDocDetail } from "@/components/knowledge/KnowledgeDocDetail";
import { DropZone } from "@/components/knowledge/upload/DropZone";
import { UploadQueue } from "@/components/knowledge/upload/UploadQueue";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import { uploadKnowledgeWithProgress } from "@/services/knowledgeApi";
import { useKnowledgeBaseStore } from "@/stores/knowledgeBaseStore";

interface KnowledgeDocumentsTabProps {
  activeDocumentId: string | null;
}

export function KnowledgeDocumentsTab({ activeDocumentId }: KnowledgeDocumentsTabProps) {
  const {
    documentIds,
    documentsById,
    loadDocuments,
    offset,
    limit,
    total,
    selectDocument,
    uploadDocument,
    isUploading,
    activeKbId,
  } = useKnowledgeBaseStore();
  const [mode, setMode] = useState<"list" | "detail">("list");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    items: uploadQueue,
    summary,
    addFiles,
    start,
    retry,
    remove,
    clearFinished,
  } = useUploadQueue({
    concurrency: 2,
    uploadFile: async (item, onProgress) => {
      if (!activeKbId) throw new Error("请先选择知识库");
      await uploadKnowledgeWithProgress(
        {
          kbId: activeKbId,
          file: item.file,
          description: item.description,
          tags: item.tags,
        },
        onProgress,
      );
    },
    onItemSuccess: () => {
      if (activeKbId) {
        void loadDocuments({ offset: 0, kbId: activeKbId });
      }
    },
  });

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  if (!activeKbId) {
    return (
      <div className="rounded-xl border border-border-light p-lg text-sm text-text-tertiary">
        请先选择知识库。
      </div>
    );
  }

  useEffect(() => {
    if (activeDocumentId) {
      setMode("detail");
    }
  }, [activeDocumentId]);

  useEffect(() => {
    if (activeKbId) {
      void loadDocuments({ offset: 0, kbId: activeKbId });
      setMode("list");
    }
  }, [activeKbId, loadDocuments]);

  return (
    <div className="space-y-lg">
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>上传文档</DialogTitle>
          </DialogHeader>
          <div className="space-y-md text-sm">
            <div>
              <div className="text-xs text-text-tertiary mb-xs">选择文件</div>
              <Input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setUploadFile(files[0]);
                    addFiles(files, {
                      description: description.trim() || undefined,
                      tags: tags
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    });
                  }
                }}
              />
            </div>
            <div>
              <div className="text-xs text-text-tertiary mb-xs">描述</div>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选"
              />
            </div>
            <div>
              <div className="text-xs text-text-tertiary mb-xs">标签（逗号分隔）</div>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例如: hr,policy"
              />
            </div>
            {uploadError && <div className="text-xs text-error">{uploadError}</div>}
            <DropZone
              onFilesSelected={(files) => {
                addFiles(files, {
                  description: description.trim() || undefined,
                  tags: tags
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                });
                if (!uploadFile && files[0]) {
                  setUploadFile(files[0]);
                }
              }}
            />
            <UploadQueue
              items={uploadQueue}
              onRetry={retry}
              onRemove={remove}
              onClearFinished={clearFinished}
            />
            {uploadQueue.length > 0 && (
              <div className="text-xs text-text-tertiary">
                队列总数 {summary.total} · 等待 {summary.pending} · 上传中 {summary.uploading} · 成功 {summary.success} · 失败 {summary.error}
              </div>
            )}
            <div className="flex justify-end gap-sm">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUploadOpen(false)}
                disabled={isUploading}
              >
                取消
              </Button>
              <Button
                size="sm"
                disabled={(!uploadFile && uploadQueue.length === 0) || isUploading}
                onClick={async () => {
                  setUploadError(null);
                  try {
                    if (uploadQueue.length > 0) {
                      start();
                      return;
                    }
                    if (!uploadFile) return;
                    const tagList = tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    await uploadDocument(uploadFile, description.trim() || undefined, tagList);
                    setUploadOpen(false);
                    setUploadFile(null);
                    setDescription("");
                    setTags("");
                  } catch (error) {
                    setUploadError(error instanceof Error ? error.message : "上传失败");
                  }
                }}
              >
                {isUploading ? "上传中..." : uploadQueue.length > 0 ? "开始队列上传" : "上传"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {mode === "list" ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">文档列表</h3>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              上传文档
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
            {documentIds.length === 0 ? (
              <div className="col-span-full rounded-xl border border-border-light p-lg text-sm text-text-tertiary text-center">
                暂无文档，先上传一个文件吧。
              </div>
            ) : (
              documentIds.map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    void selectDocument(id);
                    setMode("detail");
                  }}
                  className="text-left rounded-xl border px-md py-sm transition-colors h-24 border-border-light bg-white hover:bg-primary/5 hover:border-primary/40"
                >
                  <div className="text-sm font-medium truncate text-text-primary">
                    {documentsById[id]?.filename}
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-1 truncate">
                    {documentsById[id]?.tags?.join(" / ") || "无标签"}
                  </div>
                </button>
              ))
            )}
          </div>
          {total > 0 && (
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
              </div>
            </div>
          )}
        </>
      ) : (
        <KnowledgeDocDetail documentId={activeDocumentId} onBack={() => setMode("list")} />
      )}
    </div>
  );
}
