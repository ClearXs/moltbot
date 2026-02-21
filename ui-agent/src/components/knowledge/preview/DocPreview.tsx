"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ChevronLeft, ChevronRight, Copy, Download, ExternalLink, GripHorizontal, RotateCcw, Save } from "lucide-react";
import Editor from "@monaco-editor/react";
import type { KnowledgeDetail } from "@/services/knowledgeApi";
import { buildHeaders, getGatewayBaseUrl } from "@/services/knowledgeApi";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UniverDocPreview } from "./UniverDocPreview";
import { UniverSheetPreview } from "./UniverSheetPreview";

interface DocPreviewProps {
  detail: KnowledgeDetail | null;
  highlightKeywords?: string[];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, keywords: string[]) {
  if (!text || keywords.length === 0) return text;

  const pattern = new RegExp(`(${keywords.map((keyword) => escapeRegex(keyword)).join("|")})`, "gi");
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    const isKeyword = keywords.some((keyword) => keyword.toLowerCase() === part.toLowerCase());
    if (!isKeyword) {
      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    }
    return (
      <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-[2px] dark:bg-yellow-800">
        {part}
      </mark>
    );
  });
}

export function DocPreview({ detail, highlightKeywords = [] }: DocPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pdfPages, setPdfPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfSearch, setPdfSearch] = useState("");
  const [pdfSearchStatus, setPdfSearchStatus] = useState<string | null>(null);
  const [pptxPreviewUrl, setPptxPreviewUrl] = useState<string | null>(null);
  const [pptxPreviewLoading, setPptxPreviewLoading] = useState(false);
  const [pptxPreviewError, setPptxPreviewError] = useState<string | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const pdfRenderingRef = useRef(false);

  // JSON 编辑器状态
  const [editedJsonContent, setEditedJsonContent] = useState<string>("");
  const [isSavingJson, setIsSavingJson] = useState(false);
  const [jsonToolbarPos, setJsonToolbarPos] = useState({ x: 16, y: 16 });
  const [jsonToolbarExpanded, setJsonToolbarExpanded] = useState(false);
  const jsonAreaRef = useRef<HTMLDivElement | null>(null);
  const jsonToolbarRef = useRef<HTMLDivElement | null>(null);
  const jsonDragRef = useRef<{ dragging: boolean; dx: number; dy: number }>({
    dragging: false,
    dx: 0,
    dy: 0,
  });
  const [editedTextContent, setEditedTextContent] = useState<string>("");
  const [isSavingText, setIsSavingText] = useState(false);
  const [textToolbarPos, setTextToolbarPos] = useState({ x: 16, y: 16 });
  const [textToolbarExpanded, setTextToolbarExpanded] = useState(false);
  const textAreaRef = useRef<HTMLDivElement | null>(null);
  const textToolbarRef = useRef<HTMLDivElement | null>(null);
  const textDragRef = useRef<{ dragging: boolean; dx: number; dy: number }>({
    dragging: false,
    dx: 0,
    dy: 0,
  });
  const mime = detail?.mimetype || "";
  const filename = detail?.filename?.toLowerCase() || "";

  const isMarkdown =
    mime === "text/markdown" || filename.endsWith(".md") || filename.endsWith(".mdx");
  const isText = mime.startsWith("text/") || isMarkdown;
  const canZoom = mime.startsWith("image/") || mime === "application/pdf";
  const zoomOptions = useMemo(() => [1, 1.25, 1.5], []);
  const keywords = useMemo(
    () => highlightKeywords.map((item) => item.trim()).filter(Boolean),
    [highlightKeywords],
  );

  const isDocx =
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.endsWith(".docx");
  const isXlsx =
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    filename.endsWith(".xlsx");
  const isCsv =
    mime === "text/csv" ||
    mime === "application/csv" ||
    filename.endsWith(".csv");
  const isPptx =
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    filename.endsWith(".pptx");

  const handlePdfSearch = async (value?: string) => {
    const queryValue = (value ?? pdfSearch).trim();
    if (!pdfDocRef.current || !queryValue) return;

    setPdfLoading(true);
    setPdfSearchStatus("搜索中...");
    const normalizedQuery = queryValue.toLowerCase();
    let foundPage = 0;

    for (let pageIndex = 1; pageIndex <= pdfDocRef.current.numPages; pageIndex += 1) {
      const page = await pdfDocRef.current.getPage(pageIndex);
      const pageText = await page.getTextContent();
      const text = pageText.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .toLowerCase();
      if (text.includes(normalizedQuery)) {
        foundPage = pageIndex;
        break;
      }
    }

    if (foundPage) {
      setPdfPage(foundPage);
      setPdfSearchStatus(`命中第 ${foundPage} 页`);
    } else {
      setPdfSearchStatus("未找到匹配内容");
    }
    setPdfLoading(false);
  };

  // JSON 编辑器处理函数
  const handleSaveJson = async () => {
    if (!detail) return;

    try {
      setIsSavingJson(true);
      const formatted = JSON.stringify(JSON.parse(editedJsonContent), null, 2);

      // 调用保存 API
      const url = new URL("/api/knowledge/documents/" + detail.id + "/content", getGatewayBaseUrl());
      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          ...buildHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: formatted }),
      });

      if (!response.ok) throw new Error("保存失败");

      // 更新原始内容
      setTextContent(formatted);
      setEditedJsonContent(formatted);
      console.log("JSON 保存成功");
      // TODO: 添加成功提示 toast
    } catch (err) {
      console.error("保存 JSON 失败:", err);
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSavingJson(false);
    }
  };

  const handleResetJson = () => {
    if (!textContent) return;
    try {
      setEditedJsonContent(JSON.stringify(JSON.parse(textContent), null, 2));
    } catch {
      setEditedJsonContent(textContent);
    }
  };

  const handleSaveText = async () => {
    if (!detail) return;
    try {
      setIsSavingText(true);
      const url = new URL(`/api/knowledge/documents/${detail.id}/content`, getGatewayBaseUrl());
      const response = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          ...buildHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: editedTextContent }),
      });
      if (!response.ok) throw new Error("保存失败");
      setTextContent(editedTextContent);
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSavingText(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    let nextUrl: string | null = null;

    const loadFile = async () => {
      if (!detail) return;
      setIsLoading(true);
      const url = new URL("/api/knowledge/file", getGatewayBaseUrl());
      url.searchParams.set("documentId", detail.id);
      if (detail.kbId) {
        url.searchParams.set("kbId", detail.kbId);
      }
      const response = await fetch(url.toString(), { headers: buildHeaders() });
      if (!response.ok) {
        setIsLoading(false);
        return;
      }
      const blob = await response.blob();
      if (!isActive) return;
      nextUrl = URL.createObjectURL(blob);
      setBlobUrl(nextUrl);
      if (detail.mimetype.startsWith("text/") || detail.mimetype === "text/markdown" || detail.mimetype === "application/json") {
        const text = await blob.text();
        if (!isActive) return;
        setTextContent(text);
      }
      setIsLoading(false);
    };

    setBlobUrl(null);
    setTextContent("");
    setZoom(1);
    setPdfPages(0);
    setPdfPage(1);
    setPdfSearch("");
    setPdfSearchStatus(null);
    setPptxPreviewUrl(null);
    setPptxPreviewLoading(false);
    setPptxPreviewError(null);
    pdfDocRef.current = null;
    void loadFile();

    return () => {
      isActive = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [detail]);

  useEffect(() => {
    const loadPdf = async () => {
      if (!blobUrl || mime !== "application/pdf") return;
      setPdfLoading(true);
      const pdfjs = await import("pdfjs-dist");
      const workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      const pdf = await pdfjs.getDocument(blobUrl).promise;
      pdfDocRef.current = pdf;
      setPdfPages(pdf.numPages);
      setPdfPage(1);
      setPdfLoading(false);
    };
    void loadPdf();
  }, [blobUrl, mime]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDocRef.current || !pdfCanvasRef.current || mime !== "application/pdf") return;
      if (pdfRenderingRef.current) return;
      pdfRenderingRef.current = true;
      const page = await pdfDocRef.current.getPage(pdfPage);
      const viewport = page.getViewport({ scale: 1.2 * zoom });
      const canvas = pdfCanvasRef.current;
      const context = canvas.getContext("2d");
      if (!context) {
        pdfRenderingRef.current = false;
        return;
      }
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      pdfRenderingRef.current = false;
    };
    void renderPage();
  }, [pdfPage, zoom, mime]);

  useEffect(() => {
    if (mime !== "application/pdf" || keywords.length === 0 || !pdfDocRef.current) return;
    const firstKeyword = keywords[0];
    setPdfSearch(firstKeyword);
    const timeoutId = window.setTimeout(() => {
      void handlePdfSearch(firstKeyword);
    }, 400);
    return () => window.clearTimeout(timeoutId);
  }, [keywords, mime]);

  useEffect(() => {
    if (!detail || !isPptx) return;
    let active = true;
    let objectUrl: string | null = null;

    const loadPptxPreview = async () => {
      try {
        setPptxPreviewLoading(true);
        setPptxPreviewError(null);
        const url = new URL(`/api/knowledge/convert/pptx-to-pdf/${detail.id}`, getGatewayBaseUrl());
        if (detail.kbId) {
          url.searchParams.set("kbId", detail.kbId);
        }
        const response = await fetch(url.toString(), { headers: buildHeaders() });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`PPTX 转换失败: ${response.status} ${response.statusText} ${errorText}`);
        }
        const pdfBlob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(pdfBlob);
        setPptxPreviewUrl(objectUrl);
      } catch (error) {
        if (!active) return;
        setPptxPreviewError(error instanceof Error ? error.message : "PPTX 预览加载失败");
      } finally {
        if (active) {
          setPptxPreviewLoading(false);
        }
      }
    };

    void loadPptxPreview();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [detail, isPptx]);

  useEffect(() => {
    if (!(mime === "application/json" || filename.endsWith(".json"))) return;
    if (!textContent) return;
    try {
      const formatted = JSON.stringify(JSON.parse(textContent), null, 2);
      setEditedJsonContent(formatted);
      setTextContent(formatted);
    } catch {
      setEditedJsonContent(textContent);
    }
  }, [textContent, mime, filename]);

  useEffect(() => {
    if (!isText || isMarkdown || mime === "application/json" || filename.endsWith(".json")) return;
    setEditedTextContent(textContent);
  }, [textContent, isText, isMarkdown, mime, filename]);

  useEffect(() => {
    if (!(mime === "application/json" || filename.endsWith(".json"))) return;
    const area = jsonAreaRef.current;
    const toolbar = jsonToolbarRef.current;
    if (!area || !toolbar) return;

    const areaRect = area.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    setJsonToolbarPos({
      x: Math.max(8, areaRect.width - toolbarRect.width - 8),
      y: 8,
    });
  }, [mime, filename, jsonToolbarExpanded]);

  useEffect(() => {
    if (!isText || isMarkdown || mime === "application/json" || filename.endsWith(".json")) return;
    const area = textAreaRef.current;
    const toolbar = textToolbarRef.current;
    if (!area || !toolbar) return;
    const areaRect = area.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    setTextToolbarPos({
      x: Math.max(8, areaRect.width - toolbarRect.width - 8),
      y: 8,
    });
  }, [isText, isMarkdown, mime, filename, textToolbarExpanded]);

  if (!detail) {
    return <div className="text-sm text-text-tertiary">暂无预览</div>;
  }

  const toolbar = (
    <div className="mb-sm flex items-center justify-between">
      <div className="truncate text-xs text-text-tertiary">{detail.filename}</div>
      <div className="flex items-center gap-xs">
        {canZoom && (
          <select
            className="h-7 rounded border border-border-light bg-white px-xs text-xs"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          >
            {zoomOptions.map((value) => (
              <option key={value} value={value}>
                {Math.round(value * 100)}%
              </option>
            ))}
          </select>
        )}
        {blobUrl && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard?.writeText(textContent)}
              disabled={!isText || !textContent}
            >
              <Copy className="mr-xs h-3.5 w-3.5" />
              复制
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.open(blobUrl, "_blank", "noopener")}>
              <ExternalLink className="mr-xs h-3.5 w-3.5" />
              打开
            </Button>
            <a className="text-xs text-primary hover:underline" href={blobUrl} download={detail.filename}>
              下载
            </a>
          </>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div>
        {toolbar}
        <div className="text-sm text-text-tertiary">加载预览中...</div>
      </div>
    );
  }

  if (isDocx) {
    return blobUrl ? <UniverDocPreview documentId={detail.id} /> : <div className="text-sm text-text-tertiary">加载 Word 中...</div>;
  }

  if (isXlsx) {
    return blobUrl ? <UniverSheetPreview documentId={detail.id} /> : <div className="text-sm text-text-tertiary">加载 Excel 中...</div>;
  }

  if (isCsv) {
    return blobUrl ? (
      <UniverSheetPreview documentId={detail.id} fileType="csv" />
    ) : (
      <div className="text-sm text-text-tertiary">加载 CSV 中...</div>
    );
  }

  if (isPptx) {
    return (
      <div className="flex min-h-[360px] flex-col gap-sm">
        {pptxPreviewLoading ? (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-text-tertiary">
            正在转换并加载 PPT 预览...
          </div>
        ) : pptxPreviewUrl ? (
          <iframe
            title={detail.filename}
            src={pptxPreviewUrl}
            className="h-full min-h-[520px] w-full rounded-lg border border-border-light"
          />
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-md rounded-lg border border-border-light p-lg">
            <div className="space-y-xs text-center">
              <p className="text-base font-semibold text-text-primary">PowerPoint 文件</p>
              <p className="text-sm text-text-tertiary">
                {pptxPreviewError || "当前环境不支持在线转换预览，请下载后使用本地软件打开。"}
              </p>
            </div>
            {blobUrl && (
              <a
                href={blobUrl}
                download={detail.filename}
                className="inline-flex items-center gap-xs rounded-md bg-primary px-md py-sm text-sm text-white"
              >
                <Download className="h-4 w-4" />
                下载文件
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  // JSON 预览与编辑
  if (mime === "application/json" || filename.endsWith(".json")) {
    return blobUrl && textContent ? (
      <div ref={jsonAreaRef} className="relative h-full flex flex-col">
        <div
          ref={jsonToolbarRef}
          className="absolute z-10 flex select-none items-center gap-1 rounded-xl border border-primary/25 bg-background/95 p-1 text-text-primary shadow-sm backdrop-blur"
          style={{ left: jsonToolbarPos.x, top: jsonToolbarPos.y }}
          onMouseDown={(event) => {
            const target = event.target as HTMLElement;
            if (!target.closest("[data-json-drag]")) return;
            const area = jsonAreaRef.current;
            const toolbar = jsonToolbarRef.current;
            if (!area || !toolbar) return;
            const areaRect = area.getBoundingClientRect();
            const toolbarRect = toolbar.getBoundingClientRect();
            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
            jsonDragRef.current = {
              dragging: true,
              dx: event.clientX - rect.left,
              dy: event.clientY - rect.top,
            };
            const onMove = (moveEvent: MouseEvent) => {
              if (!jsonDragRef.current.dragging) return;
              const nextX = moveEvent.clientX - jsonDragRef.current.dx;
              const nextY = moveEvent.clientY - jsonDragRef.current.dy;
              const minX = 8;
              const minY = 8;
              const maxX = Math.max(minX, areaRect.width - toolbarRect.width - 8);
              const maxY = Math.max(minY, areaRect.height - toolbarRect.height - 8);
              setJsonToolbarPos({
                x: Math.min(maxX, Math.max(minX, nextX)),
                y: Math.min(maxY, Math.max(minY, nextY)),
              });
            };
            const onUp = () => {
              jsonDragRef.current.dragging = false;
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          title="拖拽移动工具栏"
        >
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-json-drag
                  type="button"
                  className="flex h-7 w-7 cursor-move items-center justify-center rounded-md bg-background/80 text-text-secondary transition-colors hover:bg-primary/15 hover:text-primary"
                >
                  <GripHorizontal className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">拖拽</TooltipContent>
            </Tooltip>
            {jsonToolbarExpanded ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      data-json-action
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary"
                      onClick={() => navigator.clipboard?.writeText(editedJsonContent)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">复制</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      data-json-action
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary"
                      onClick={() => window.open(blobUrl, "_blank", "noopener")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">打开</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      data-json-action
                      href={blobUrl}
                      download={detail.filename}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">下载</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      data-json-action
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary disabled:opacity-40"
                      onClick={handleResetJson}
                      disabled={isSavingJson}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">重置</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      data-json-action
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
                      onClick={handleSaveJson}
                      disabled={isSavingJson}
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">保存</TooltipContent>
                </Tooltip>
              </>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-json-action
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-text-secondary transition-colors hover:bg-primary/15 hover:text-primary"
                  onClick={() => setJsonToolbarExpanded((value) => !value)}
                >
                  {jsonToolbarExpanded ? (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{jsonToolbarExpanded ? "收起" : "展开"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex-1 overflow-hidden rounded-lg border border-border-light">
          <Editor
            height="100%"
            language="json"
            value={editedJsonContent}
            onChange={(value) => setEditedJsonContent(value || "")}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              formatOnPaste: true,
              formatOnType: true,
              scrollBeyondLastLine: false,
              fontSize: 14,
              tabSize: 2,
            }}
            theme="vs-dark"
          />
        </div>
      </div>
    ) : (
      <div className="text-sm text-text-tertiary">加载 JSON 中...</div>
    );
  }

  if (mime.startsWith("image/")) {
    return blobUrl ? (
      <div>
        {toolbar}
        <img
          src={blobUrl}
          alt={detail.filename}
          className="max-h-[360px] object-contain"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        />
      </div>
    ) : (
      <div className="text-sm text-text-tertiary">加载图片中...</div>
    );
  }

  if (mime.startsWith("audio/")) {
    return blobUrl ? (
      <div>
        {toolbar}
        <audio controls className="w-full" src={blobUrl} />
      </div>
    ) : (
      <div className="text-sm text-text-tertiary">加载音频中...</div>
    );
  }

  if (mime.startsWith("video/")) {
    return blobUrl ? (
      <div>
        {toolbar}
        <video controls className="w-full" src={blobUrl} />
      </div>
    ) : (
      <div className="text-sm text-text-tertiary">加载视频中...</div>
    );
  }

  if (mime === "application/pdf") {
    return blobUrl ? (
      <div>
        {toolbar}
        <div className="mb-sm flex items-center gap-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={pdfPage <= 1 || pdfLoading}
            onClick={() => setPdfPage((prev) => Math.max(1, prev - 1))}
          >
            上一页
          </Button>
          <div className="text-xs text-text-tertiary">{pdfPages ? `${pdfPage} / ${pdfPages}` : "加载中"}</div>
          <Button
            size="sm"
            variant="outline"
            disabled={pdfPages === 0 || pdfPage >= pdfPages || pdfLoading}
            onClick={() => setPdfPage((prev) => Math.min(pdfPages, prev + 1))}
          >
            下一页
          </Button>
          <div className="ml-auto flex items-center gap-xs">
            <input
              className="h-7 w-40 rounded border border-border-light bg-white px-xs text-xs"
              placeholder="搜索 PDF 文本"
              value={pdfSearch}
              onChange={(event) => setPdfSearch(event.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!pdfSearch.trim() || pdfLoading}
              onClick={() => void handlePdfSearch()}
            >
              搜索
            </Button>
          </div>
        </div>
        {pdfSearchStatus && <div className="mb-sm text-xs text-text-tertiary">{pdfSearchStatus}</div>}
        <div className="overflow-auto rounded-lg border border-border-light bg-white p-sm">
          <canvas ref={pdfCanvasRef} className="max-w-full" />
        </div>
      </div>
    ) : (
      <div className="text-sm text-text-tertiary">加载 PDF 中...</div>
    );
  }

  if (isText) {
    if (!isMarkdown) {
      return (
        <div ref={textAreaRef} className="relative h-full flex flex-col">
          <div
            ref={textToolbarRef}
            className="absolute z-10 flex select-none items-center gap-1 rounded-xl border border-primary/25 bg-background/95 p-1 text-text-primary shadow-sm backdrop-blur"
            style={{ left: textToolbarPos.x, top: textToolbarPos.y }}
            onMouseDown={(event) => {
              const target = event.target as HTMLElement;
              if (!target.closest("[data-text-drag]")) return;
              const area = textAreaRef.current;
              const toolbar = textToolbarRef.current;
              if (!area || !toolbar) return;
              const areaRect = area.getBoundingClientRect();
              const toolbarRect = toolbar.getBoundingClientRect();
              const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
              textDragRef.current = {
                dragging: true,
                dx: event.clientX - rect.left,
                dy: event.clientY - rect.top,
              };
              const onMove = (moveEvent: MouseEvent) => {
                if (!textDragRef.current.dragging) return;
                const nextX = moveEvent.clientX - textDragRef.current.dx;
                const nextY = moveEvent.clientY - textDragRef.current.dy;
                const minX = 8;
                const minY = 8;
                const maxX = Math.max(minX, areaRect.width - toolbarRect.width - 8);
                const maxY = Math.max(minY, areaRect.height - toolbarRect.height - 8);
                setTextToolbarPos({
                  x: Math.min(maxX, Math.max(minX, nextX)),
                  y: Math.min(maxY, Math.max(minY, nextY)),
                });
              };
              const onUp = () => {
                textDragRef.current.dragging = false;
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    data-text-drag
                    type="button"
                    className="flex h-7 w-7 cursor-move items-center justify-center rounded-md bg-background/80 text-text-secondary transition-colors hover:bg-primary/15 hover:text-primary"
                  >
                    <GripHorizontal className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">拖拽</TooltipContent>
              </Tooltip>
              {textToolbarExpanded ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary"
                        onClick={() => navigator.clipboard?.writeText(editedTextContent)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">复制</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary"
                        onClick={() => blobUrl && window.open(blobUrl, "_blank", "noopener")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">打开</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={blobUrl || undefined}
                        download={detail.filename}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">下载</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-primary transition-colors hover:bg-primary/15 hover:text-primary disabled:opacity-40"
                        onClick={() => setEditedTextContent(textContent)}
                        disabled={isSavingText}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">重置</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
                        onClick={handleSaveText}
                        disabled={isSavingText}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">保存</TooltipContent>
                  </Tooltip>
                </>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-text-secondary transition-colors hover:bg-primary/15 hover:text-primary"
                    onClick={() => setTextToolbarExpanded((value) => !value)}
                  >
                    {textToolbarExpanded ? (
                      <ChevronLeft className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{textToolbarExpanded ? "收起" : "展开"}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 overflow-hidden rounded-lg border border-border-light">
            <Editor
              height="100%"
              language="plaintext"
              value={editedTextContent}
              onChange={(value) => setEditedTextContent(value || "")}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                wordWrap: "on",
                scrollBeyondLastLine: false,
                fontSize: 14,
                tabSize: 2,
              }}
              theme="vs-dark"
            />
          </div>
        </div>
      );
    }

    return (
      <div>
        {toolbar}
        {isMarkdown ? (
          <div className="prose prose-sm max-w-none text-text-secondary">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p({ children }) {
                  const content = Array.isArray(children) ? children.join("") : String(children ?? "");
                  return <p>{highlightText(content, keywords)}</p>;
                },
                li({ children }) {
                  const content = Array.isArray(children) ? children.join("") : String(children ?? "");
                  return <li>{highlightText(content, keywords)}</li>;
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  if (match) {
                    return (
                      <SyntaxHighlighter language={match[1]} PreTag="div" {...props}>
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    );
                  }
                  return (
                    <code className="rounded bg-background-secondary px-1" {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {textContent || "加载文本中..."}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm text-text-secondary">
            {highlightText(textContent || "加载文本中...", keywords)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      <div className="text-sm text-text-tertiary">当前格式暂不支持预览，可下载文件查看。</div>
    </div>
  );
}
