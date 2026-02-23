import type { DatabaseSync } from "node:sqlite";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import { KnowledgeManager } from "../../memory/knowledge-manager.js";
import { requireNodeSqlite } from "../../memory/sqlite.js";
import type { MemorySearchResult } from "../../memory/types.js";
import { resolveAgentDir, resolveAgentWorkspaceDir } from "../agent-scope.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readStringParam, readStringArrayParam, readNumberParam } from "./common.js";

const dbByAgent = new Map<string, DatabaseSync>();

function getDatabase(agentId: string): DatabaseSync {
  const existing = dbByAgent.get(agentId);
  if (existing) {
    return existing;
  }
  const { DatabaseSync } = requireNodeSqlite();
  const cfg = loadConfig();
  const agentDir = resolveAgentDir(cfg, agentId);
  const dbPath = `${agentDir}/memory.db`;
  const db = new DatabaseSync(dbPath);
  dbByAgent.set(agentId, db);
  return db;
}

function getKnowledgeManager(agentId: string): KnowledgeManager {
  const cfg = loadConfig();
  const db = getDatabase(agentId);
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  return new KnowledgeManager({ cfg, db, baseDir: workspaceDir });
}

/**
 * knowledge_list - List knowledge base documents
 */
const KnowledgeListSchema = Type.Object({
  kbId: Type.Optional(Type.String({ description: "Knowledge base ID (optional)" })),
  tags: Type.Optional(Type.Array(Type.String(), { description: "Filter by tags (optional)" })),
  limit: Type.Optional(
    Type.Number({ description: "Maximum number of documents to return (default: 20)" }),
  ),
  offset: Type.Optional(
    Type.Number({ description: "Number of documents to skip for pagination (default: 0)" }),
  ),
});

export function createKnowledgeListTool(opts: { agentId: string }): AnyAgentTool {
  return {
    label: "Knowledge List",
    name: "knowledge_list",
    description:
      "List knowledge base documents. Returns document metadata including filename, upload date, size, tags, and description. Use this to see what documents are available before searching or to browse by tags.",
    parameters: KnowledgeListSchema,
    execute: async (_toolCallId, params) => {
      const manager = getKnowledgeManager(opts.agentId);

      if (!manager.isEnabled(opts.agentId)) {
        throw new Error("Knowledge base is not enabled for this agent");
      }

      const kbId = readStringParam(params, "kbId");
      const tags = readStringArrayParam(params, "tags");
      const limit = readNumberParam(params, "limit", { integer: true }) ?? 20;
      const offset = readNumberParam(params, "offset", { integer: true }) ?? 0;

      const documents = manager.listDocuments({
        agentId: opts.agentId,
        kbId,
        tags,
        limit,
        offset,
      });

      const count = manager.getDocumentCount({ agentId: opts.agentId, kbId });

      return jsonResult({
        total: count,
        returned: documents.length,
        offset,
        documents: documents.map((doc) => ({
          id: doc.id,
          kbId: doc.kb_id ?? null,
          filename: doc.filename,
          mimetype: doc.mimetype,
          size: doc.size,
          uploadedAt: new Date(doc.uploaded_at).toISOString(),
          indexed: doc.indexed_at !== null,
          tags: doc.tags,
          description: doc.description,
          sourceType: doc.source_type,
        })),
      });
    },
  };
}

/**
 * knowledge_search - Search knowledge base using vector/hybrid search
 */
const KnowledgeSearchSchema = Type.Object({
  query: Type.String({ description: "Search query text" }),
  kbId: Type.Optional(Type.String({ description: "Knowledge base ID (optional)" })),
  limit: Type.Optional(
    Type.Number({ description: "Maximum number of results to return (default: 5)" }),
  ),
});

export function createKnowledgeSearchTool(opts: { agentId: string }): AnyAgentTool {
  return {
    label: "Knowledge Search",
    name: "knowledge_search",
    description:
      "Search knowledge base documents using semantic search. Returns relevant document excerpts with their source filename and context. Use this to find information within uploaded documents.",
    parameters: KnowledgeSearchSchema,
    execute: async (_toolCallId, params) => {
      const manager = getKnowledgeManager(opts.agentId);

      if (!manager.isEnabled(opts.agentId)) {
        throw new Error("Knowledge base is not enabled for this agent");
      }

      const query = readStringParam(params, "query", { required: true });
      const kbId = readStringParam(params, "kbId");
      const limit = readNumberParam(params, "limit", { integer: true }) ?? 5;
      const resolvedKbId = kbId ?? manager.getBase(opts.agentId)?.id;
      const baseSettings = resolvedKbId
        ? manager.getBaseSettings({ agentId: opts.agentId, kbId: resolvedKbId })
        : {
            retrieval: { mode: "hybrid", topK: 5, minScore: 0.35, hybridAlpha: 0.5 },
          };
      const maxResults = Math.max(1, Math.min(limit, baseSettings.retrieval.topK));

      // Note: This requires MemoryIndexManager to be available
      // The search will be performed through the memory index
      const { MemoryIndexManager } = await import("../../memory/manager.js");
      const memoryManager = await MemoryIndexManager.get({
        cfg: loadConfig(),
        agentId: opts.agentId,
      });

      if (!memoryManager) {
        throw new Error("Memory search is not configured for this agent");
      }

      const rawResults = await memoryManager.search(query, {
        maxResults: Math.max(maxResults, baseSettings.retrieval.topK),
        minScore: 0,
      });
      const rankedResults = rankKnowledgeResults({
        results: rawResults,
        query,
        retrievalMode: baseSettings.retrieval.mode,
        minScore: baseSettings.retrieval.minScore,
        hybridAlpha: baseSettings.retrieval.hybridAlpha,
        maxResults,
      });

      const formattedResults = rankedResults
        .filter((result) => result.source === "knowledge")
        .map((result) => {
          const documentId = result.path.replace(/^knowledge\//, "");
          const doc = manager.getDocument({
            documentId,
            agentId: opts.agentId,
          });
          if (kbId && doc?.kb_id !== kbId) {
            return null;
          }
          return {
            documentId,
            kbId: doc?.kb_id ?? null,
            filename: doc?.filename ?? documentId,
            chunkId: result.id,
            snippet: result.snippet,
            score: result.score,
            lines: `${result.startLine}-${result.endLine}`,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      return jsonResult({
        query,
        resultsCount: formattedResults.length,
        results: formattedResults,
      });
    },
  };
}

type RankedKnowledgeResult = MemorySearchResult & {
  score: number;
};

export function rankKnowledgeResults(params: {
  results: MemorySearchResult[];
  query: string;
  retrievalMode: "semantic" | "keyword" | "hybrid";
  minScore: number;
  hybridAlpha: number;
  maxResults: number;
}): RankedKnowledgeResult[] {
  const queryTerms = tokenizeQuery(params.query);
  const scored = params.results.map((result) => {
    const keywordScore = computeKeywordScore(result, queryTerms);
    if (params.retrievalMode === "keyword") {
      return { ...result, score: keywordScore };
    }
    if (params.retrievalMode === "hybrid") {
      return {
        ...result,
        score: params.hybridAlpha * result.score + (1 - params.hybridAlpha) * keywordScore,
      };
    }
    return { ...result, score: result.score };
  });

  return scored
    .filter((result) => result.score >= params.minScore)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, Math.max(1, params.maxResults));
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,，。！？!?;；:：]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function computeKeywordScore(result: MemorySearchResult, queryTerms: string[]): number {
  if (queryTerms.length === 0) {
    return 0;
  }
  const text = `${result.snippet} ${result.path}`.toLowerCase();
  const hits = queryTerms.reduce((count, term) => (text.includes(term) ? count + 1 : count), 0);
  return hits / queryTerms.length;
}

/**
 * knowledge_delete - Delete a knowledge base document
 */
const KnowledgeDeleteSchema = Type.Object({
  documentId: Type.String({ description: "Document ID to delete" }),
  kbId: Type.Optional(Type.String({ description: "Knowledge base ID (optional)" })),
});

export function createKnowledgeDeleteTool(opts: { agentId: string }): AnyAgentTool {
  return {
    label: "Knowledge Delete",
    name: "knowledge_delete",
    description:
      "Delete a knowledge base document by its ID. This permanently removes the document and its index. Use knowledge_list first to find the document ID.",
    parameters: KnowledgeDeleteSchema,
    execute: async (_toolCallId, params) => {
      const manager = getKnowledgeManager(opts.agentId);

      if (!manager.isEnabled(opts.agentId)) {
        throw new Error("Knowledge base is not enabled for this agent");
      }

      const documentId = readStringParam(params, "documentId", { required: true });
      const kbId = readStringParam(params, "kbId");

      const result = await manager.deleteDocument({
        documentId,
        agentId: opts.agentId,
        kbId,
      });

      if (!result.success) {
        throw new Error(`Document not found: ${documentId}`);
      }

      return jsonResult({
        success: true,
        documentId,
        message: "Document deleted successfully",
      });
    },
  };
}

/**
 * knowledge_get - Get details of a specific document
 */
const KnowledgeGetSchema = Type.Object({
  documentId: Type.String({ description: "Document ID to retrieve" }),
  kbId: Type.Optional(Type.String({ description: "Knowledge base ID (optional)" })),
});

export function createKnowledgeGetTool(opts: { agentId: string }): AnyAgentTool {
  return {
    label: "Knowledge Get",
    name: "knowledge_get",
    description:
      "Get detailed information about a specific knowledge base document by its ID, including all metadata and tags.",
    parameters: KnowledgeGetSchema,
    execute: async (_toolCallId, params) => {
      const manager = getKnowledgeManager(opts.agentId);

      if (!manager.isEnabled(opts.agentId)) {
        throw new Error("Knowledge base is not enabled for this agent");
      }

      const documentId = readStringParam(params, "documentId", { required: true });
      const kbId = readStringParam(params, "kbId");

      const doc = manager.getDocument({
        documentId,
        agentId: opts.agentId,
        kbId,
      });

      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      return jsonResult({
        id: doc.id,
        kbId: doc.kb_id ?? null,
        filename: doc.filename,
        filepath: doc.filepath,
        mimetype: doc.mimetype,
        size: doc.size,
        hash: doc.hash,
        sourceType: doc.source_type,
        sourceMetadata: doc.source_metadata ? JSON.parse(doc.source_metadata) : null,
        uploadedAt: new Date(doc.uploaded_at).toISOString(),
        indexedAt: doc.indexed_at ? new Date(doc.indexed_at).toISOString() : null,
        description: doc.description,
        tags: doc.tags,
      });
    },
  };
}
