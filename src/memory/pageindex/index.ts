/**
 * PageIndex 主入口
 *
 * 整合所有模块，提供统一的 API
 */

import fs from "node:fs/promises";
import path from "node:path";
import { resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import { parsePDF } from "./pdf.js";
import { searchPageIndex } from "./search.js";
import { generateTOCFromText } from "./toc.js";
import { buildTree, processLargeNodes } from "./tree.js";
import type {
  PageIndexTree,
  PageIndexSearchResult,
  BuildIndexParams,
  BuildIndexResult,
  SearchParams,
  SessionPageIndexMeta,
} from "./types.js";

/**
 * 构建 PageIndex 索引
 *
 * @param params 构建参数
 * @returns 构建结果
 */
export async function buildIndex(params: BuildIndexParams): Promise<BuildIndexResult> {
  const { filePath, sessionKey, documentId, agentId } = params;

  try {
    // 1. 解析 PDF
    console.log(`[PageIndex] Parsing PDF: ${filePath}`);
    const parseResult = await parsePDF(filePath);

    // 2. 检测 TOC
    let tocItems = parseResult.toc || [];

    if (tocItems.length === 0) {
      // 没有目录，尝试从文本生成
      console.log(`[PageIndex] No TOC found, generating from text...`);
      const generated = await generateTOCFromText(parseResult.text);
      tocItems = generated.items;
    }

    // 3. 构建树结构
    console.log(`[PageIndex] Building tree structure...`);
    const tree = buildTree(tocItems);

    // 4. 处理大节点
    const processedTree = processLargeNodes(tree, 10);

    // 5. 生成节点摘要（可选）
    // 简化实现：跳过摘要生成，直接保存

    // 6. 构建索引对象
    const pageIndexTree: PageIndexTree = {
      docName: path.basename(filePath),
      structure: processedTree,
    };

    // 7. 保存到文件
    const outputPath = await saveIndex(pageIndexTree, sessionKey, documentId, agentId);

    // 8. 更新元数据
    await updateSessionMeta(sessionKey, documentId, path.basename(filePath), outputPath, agentId);

    return {
      success: true,
      documentId,
      indexPath: outputPath,
    };
  } catch (error) {
    console.error(`[PageIndex] Build failed:`, error);
    return {
      success: false,
      documentId,
      error: String(error),
    };
  }
}

/**
 * 搜索索引
 *
 * @param params 搜索参数
 * @returns 搜索结果
 */
export async function search(params: SearchParams): Promise<PageIndexSearchResult[]> {
  const { indexPath, query, limit = 5 } = params;

  try {
    // 1. 加载索引
    const tree = await loadIndex(indexPath);

    if (!tree) {
      console.error(`[PageIndex] Index not found: ${indexPath}`);
      return [];
    }

    // 2. 执行搜索
    const results = await searchPageIndex(tree, query, limit);

    return results;
  } catch (error) {
    console.error(`[PageIndex] Search failed:`, error);
    return [];
  }
}

/**
 * 保存索引到文件
 */
async function saveIndex(
  tree: PageIndexTree,
  sessionKey: string,
  documentId: string,
  agentId: string,
): Promise<string> {
  // 使用正确的方式获取 workspace 目录
  const cfg = loadConfig();
  const baseDir = resolveAgentWorkspaceDir(cfg, agentId);
  const indexDir = path.join(baseDir, "sessions", sessionKey, ".pageindex", "indices", documentId);

  await fs.mkdir(indexDir, { recursive: true });

  const indexPath = path.join(indexDir, "index.json");
  await fs.writeFile(indexPath, JSON.stringify(tree, null, 2), "utf-8");

  return indexPath;
}

/**
 * 加载索引文件
 */
async function loadIndex(indexPath: string): Promise<PageIndexTree | null> {
  try {
    const content = await fs.readFile(indexPath, "utf-8");
    return JSON.parse(content) as PageIndexTree;
  } catch {
    return null;
  }
}

/**
 * 更新 Session PageIndex 元数据
 */
export async function updateSessionMeta(
  sessionKey: string,
  documentId: string,
  filename: string,
  indexPath: string | undefined,
  agentId: string = "default",
): Promise<void> {
  const cfg = loadConfig();
  const baseDir = resolveAgentWorkspaceDir(cfg, agentId);
  const metaPath = path.join(baseDir, "sessions", sessionKey, ".pageindex", "meta.json");

  // 根据文件扩展名推断 mimeType
  const ext = filename.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
  };
  const mimeType = ext ? mimeTypes[ext] || "application/octet-stream" : "application/octet-stream";

  let meta: SessionPageIndexMeta;

  try {
    const content = await fs.readFile(metaPath, "utf-8");
    meta = JSON.parse(content);
  } catch {
    // 文件不存在，创建新的
    meta = {
      sessionKey,
      documents: [],
      updatedAt: Date.now(),
    };
  }

  // 更新或添加文档
  const existingIndex = meta.documents.findIndex((d) => d.documentId === documentId);
  const docMeta = {
    documentId,
    filename,
    mimeType,
    indexPath: indexPath || null,
    builtAt: Date.now(),
  };

  if (existingIndex >= 0) {
    meta.documents[existingIndex] = docMeta;
  } else {
    meta.documents.push(docMeta);
  }

  meta.updatedAt = Date.now();

  // 保存
  const metaDir = path.dirname(metaPath);
  await fs.mkdir(metaDir, { recursive: true });
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * 获取 Session 的 PageIndex 元数据
 */
export async function getSessionMeta(
  sessionKey: string,
  agentId: string = "default",
): Promise<SessionPageIndexMeta | null> {
  const cfg = loadConfig();
  const baseDir = resolveAgentWorkspaceDir(cfg, agentId);
  const metaPath = path.join(baseDir, "sessions", sessionKey, ".pageindex", "meta.json");

  try {
    const content = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(content) as SessionPageIndexMeta;
  } catch {
    return null;
  }
}

/**
 * 检查索引是否存在
 */
export async function hasIndex(
  sessionKey: string,
  documentId: string,
  agentId: string = "default",
): Promise<boolean> {
  const cfg = loadConfig();
  const baseDir = resolveAgentWorkspaceDir(cfg, agentId);
  const indexPath = path.join(
    baseDir,
    "sessions",
    sessionKey,
    ".pageindex",
    "indices",
    documentId,
    "index.json",
  );

  try {
    await fs.access(indexPath);
    return true;
  } catch {
    return false;
  }
}

// 导出所有类型和模块
export * from "./types.js";
export * from "./pdf.js";
export * from "./llm.js";
export * from "./toc.js";
export * from "./tree.js";
export * from "./search.js";
