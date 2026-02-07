"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Download, ExternalLink } from "lucide-react";
import type { KnowledgeDetail } from "@/services/knowledgeApi";
import { buildHeaders, getGatewayBaseUrl } from "@/services/knowledgeApi";
import { Button } from "@/components/ui/button";
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
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const pdfRenderingRef = useRef(false);
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
      if (detail.mimetype.startsWith("text/") || detail.mimetype === "text/markdown") {
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
    return blobUrl ? <UniverDocPreview fileUrl={blobUrl} /> : <div className="text-sm text-text-tertiary">加载 Word 中...</div>;
  }

  if (isXlsx) {
    return blobUrl ? <UniverSheetPreview fileUrl={blobUrl} /> : <div className="text-sm text-text-tertiary">加载 Excel 中...</div>;
  }

  if (isPptx) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-md rounded-lg border border-border-light p-lg">
        <div className="space-y-xs text-center">
          <p className="text-base font-semibold text-text-primary">PowerPoint 文件</p>
          <p className="text-sm text-text-tertiary">暂不支持在线预览，请下载后使用本地软件打开。</p>
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
    );
  }

  // JSON 预览
  if (mime === "application/json" || filename.endsWith(".json")) {
    return blobUrl && textContent ? (
      <div>
        {toolbar}
        <pre className="overflow-auto rounded-lg bg-muted p-4 text-sm font-mono">
          <code className="language-json">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(textContent), null, 2);
              } catch {
                return textContent;
              }
            })()}
          </code>
        </pre>
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
