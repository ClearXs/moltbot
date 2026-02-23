"use client";

import { IUniverInstanceService, LocaleType, Univer, UniverInstanceType } from "@univerjs/core";
import { defaultTheme } from "@univerjs/design";
import { UniverDocsPlugin } from "@univerjs/docs";
import { IEditorService, UniverDocsUIPlugin } from "@univerjs/docs-ui";
import docsUiZhCN from "@univerjs/docs-ui/locale/zh-CN";
import { IRenderManagerService, UniverRenderEnginePlugin } from "@univerjs/engine-render";
import { UniverUIPlugin } from "@univerjs/ui";
import uiZhCN from "@univerjs/ui/locale/zh-CN";
import { Loader2, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buildHeaders, getGatewayBaseUrl } from "@/services/knowledgeApi";
import "@univerjs/design/lib/index.css";
import "@univerjs/ui/lib/index.css";
import "@univerjs/docs-ui/lib/index.css";

const univerLocales = {
  [LocaleType.ZH_CN]: {
    ...uiZhCN,
    ...docsUiZhCN,
  },
};

interface UniverDocPreviewProps {
  documentId: string;
  onError?: (error: Error) => void;
}

function normalizeDocSnapshot(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const snapshot = raw as {
    locale?: string;
    title?: string;
    tableSource?: Record<string, unknown>;
    drawings?: Record<string, unknown>;
    drawingsOrder?: string[];
    headers?: Record<string, unknown>;
    footers?: Record<string, unknown>;
    body?: {
      dataStream?: string;
      textRuns?: unknown[];
      customBlocks?: unknown[];
      tables?: unknown[];
      customRanges?: unknown[];
      customDecorations?: unknown[];
    };
  };

  const stream = snapshot.body?.dataStream;
  if (typeof stream !== "string") {
    return raw;
  }

  const normalized = stream.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r");
  const paragraphStream = normalized.endsWith("\r") ? normalized : `${normalized}\r`;
  const dataStream = `${paragraphStream}\n`;
  const paragraphs: Array<{ startIndex: number }> = [];

  for (let i = 0; i < dataStream.length; i += 1) {
    if (dataStream[i] === "\r") {
      paragraphs.push({ startIndex: i });
    }
  }

  return {
    ...snapshot,
    locale: snapshot.locale ?? "zhCN",
    title: snapshot.title ?? "",
    tableSource: snapshot.tableSource ?? {},
    drawings: snapshot.drawings ?? {},
    drawingsOrder: snapshot.drawingsOrder ?? [],
    headers: snapshot.headers ?? {},
    footers: snapshot.footers ?? {},
    body: {
      ...snapshot.body,
      dataStream,
      textRuns: snapshot.body?.textRuns ?? [],
      customBlocks: snapshot.body?.customBlocks ?? [],
      tables: snapshot.body?.tables ?? [],
      customRanges: snapshot.body?.customRanges ?? [],
      customDecorations: snapshot.body?.customDecorations ?? [],
      paragraphs,
      sectionBreaks: [{ startIndex: Math.max(0, dataStream.length - 1) }],
    },
  };
}

export function UniverDocPreview({ documentId, onError }: UniverDocPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = new URL(`/api/knowledge/convert/to-univer/${documentId}`, getGatewayBaseUrl());
        url.searchParams.set("type", "docx");

        const response = await fetch(url.toString(), {
          headers: buildHeaders(),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to load document: ${response.status} ${response.statusText} ${errorText}`,
          );
        }

        const result = await response.json();
        setDocumentData(normalizeDocSnapshot(result.data));
      } catch (err) {
        if (controller.signal.aborted) return;
        const loadError = err instanceof Error ? err : new Error("Failed to load document");
        setError(loadError.message);
        onError?.(loadError);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadDocument();

    return () => controller.abort();
  }, [documentId, onError]);

  useEffect(() => {
    if (!documentData || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const univer = new Univer({
      theme: defaultTheme,
      locale: LocaleType.ZH_CN,
      locales: univerLocales,
    });

    univer.registerPlugin(UniverRenderEnginePlugin);
    univer.registerPlugin(UniverUIPlugin, { container });
    univer.registerPlugin(UniverDocsPlugin, { hasScroll: true });
    univer.registerPlugin(UniverDocsUIPlugin);

    const docUnit = univer.createUnit(UniverInstanceType.UNIVER_DOC, documentData);
    const injector = (univer as unknown as { __getInjector?: () => unknown }).__getInjector?.() as
      | { get?: (token: unknown) => unknown }
      | undefined;

    const unitId =
      typeof (docUnit as { getUnitId?: () => string }).getUnitId === "function"
        ? (docUnit as { getUnitId: () => string }).getUnitId()
        : "";

    const instanceService = injector?.get?.(IUniverInstanceService) as
      | IUniverInstanceService
      | undefined;
    const renderManagerService = injector?.get?.(IRenderManagerService) as
      | IRenderManagerService
      | undefined;
    const editorService = injector?.get?.(IEditorService) as IEditorService | undefined;

    const ensureActiveUnit = () => {
      if (!unitId || !instanceService) return;
      instanceService.setCurrentUnitForType(unitId);
      instanceService.focusUnit(unitId);
      container.focus({ preventScroll: true });
      const editor = editorService?.getEditor(unitId);
      if (editor && !editor.params.scrollBar) {
        editor.update({ scrollBar: true });
      }
    };
    const handleWheel = (event: WheelEvent) => {
      if (!unitId || !renderManagerService || event.ctrlKey) return;
      const render = renderManagerService.getRenderById(unitId);
      if (!render) return;
      const scene = render.scene;
      const target = event.target as HTMLElement | null;
      const x =
        typeof (event as WheelEvent & { offsetX?: number }).offsetX === "number"
          ? (event as WheelEvent & { offsetX: number }).offsetX
          : target?.getBoundingClientRect
            ? event.clientX - target.getBoundingClientRect().left
            : 0;
      const y =
        typeof (event as WheelEvent & { offsetY?: number }).offsetY === "number"
          ? (event as WheelEvent & { offsetY: number }).offsetY
          : target?.getBoundingClientRect
            ? event.clientY - target.getBoundingClientRect().top
            : 0;
      const activeViewport =
        scene.getActiveViewportByCoord({ x, y } as never) ??
        scene.getViewport("viewMain") ??
        scene.getMainViewport();
      if (!activeViewport) return;
      activeViewport.onMouseWheel(
        event as unknown as never,
        {
          stopPropagation: () => {},
          skipNextObservers: false,
          isStopPropagation: false,
        } as unknown as never,
      );
    };

    ensureActiveUnit();
    const timers = [0, 80, 200].map((delay) => window.setTimeout(ensureActiveUnit, delay));

    container.addEventListener("pointerdown", ensureActiveUnit, { capture: true });
    container.addEventListener("mouseenter", ensureActiveUnit);
    container.addEventListener("focusin", ensureActiveUnit);
    container.addEventListener("wheel", handleWheel, { capture: true, passive: false });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      container.removeEventListener("pointerdown", ensureActiveUnit, true);
      container.removeEventListener("mouseenter", ensureActiveUnit);
      container.removeEventListener("focusin", ensureActiveUnit);
      container.removeEventListener("wheel", handleWheel, true);
      univer.dispose();
    };
  }, [documentData]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在加载文档...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center space-y-2">
          <p className="text-base font-medium">加载失败</p>
          <p className="text-sm text-muted-foreground max-w-[28rem]">{error}</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} tabIndex={0} className="h-full w-full min-h-0 overflow-hidden" />;
}
