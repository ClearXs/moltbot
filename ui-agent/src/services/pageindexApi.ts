/**
 * PageIndex 前端 API
 *
 * 提供 PageIndex 相关的 API 调用
 */

import { useConnectionStore } from "@/stores/connectionStore";
import type { ClawdbotWebSocketClient } from "./clawdbot-websocket";

// ========== 类型定义 ==========

export interface PageIndexDocument {
  id: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  pageIndexReady: boolean;
}

export interface PageIndexSearchResult {
  documentId: string;
  filename: string;
  content: string;
  pageNumber: number;
  section: string;
  score: number;
}

export interface PageIndexUploadResponse {
  success: boolean;
  documentId: string;
  indexed: boolean;
  pageIndexBuilt: boolean;
  message?: string;
}

export interface PageIndexSearchResponse {
  results: PageIndexSearchResult[];
}

export interface PageIndexCheckResponse {
  pandocAvailable: boolean;
  openaiApiKey: boolean;
}

// ========== WebSocket 客户端 ==========

function getWsClient(): ClawdbotWebSocketClient | null {
  const store = useConnectionStore.getState();
  return store.wsClient;
}

function isWsConnected(): boolean {
  const client = getWsClient();
  return client?.isConnected() ?? false;
}

async function callPageIndexWs<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const client = getWsClient();
  if (!client || !client.isConnected()) {
    throw new Error("无法连接到服务器，请刷新页面或检查网络连接");
  }
  return client.sendRequest<T>(method, params);
}

// ========== API 函数 ==========

/**
 * 上传 Session 文档
 */
export async function uploadSessionDocument(params: {
  sessionKey: string;
  file: File;
}): Promise<PageIndexUploadResponse> {
  // 读取文件为 Base64
  const arrayBuffer = await params.file.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ""),
  );

  // 检测 MIME 类型
  const mimeType = params.file.type || "application/octet-stream";

  return callPageIndexWs<PageIndexUploadResponse>("pageindex.document.upload", {
    sessionKey: params.sessionKey,
    filename: params.file.name,
    mimeType,
    content: base64,
  });
}

/**
 * 获取 Session 文档列表
 */
export async function listSessionDocuments(
  sessionKey: string,
): Promise<{ documents: PageIndexDocument[] }> {
  return callPageIndexWs<{ documents: PageIndexDocument[] }>("pageindex.document.list", {
    sessionKey,
  });
}

/**
 * 搜索 PageIndex
 */
export async function searchPageIndex(params: {
  sessionKey: string;
  query: string;
  limit?: number;
}): Promise<PageIndexSearchResponse> {
  return callPageIndexWs<PageIndexSearchResponse>("pageindex.search", {
    sessionKey: params.sessionKey,
    query: params.query,
    limit: params.limit ?? 5,
  });
}

/**
 * 检查 PageIndex 环境
 */
export async function checkPageIndex(): Promise<PageIndexCheckResponse> {
  return callPageIndexWs<PageIndexCheckResponse>("pageindex.check", {});
}

/**
 * 判断文件是否支持 PageIndex
 */
export function isPageIndexSupported(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  return [".pdf", ".docx", ".doc", ".txt", ".md", ".markdown"].includes(`.${ext}`);
}
