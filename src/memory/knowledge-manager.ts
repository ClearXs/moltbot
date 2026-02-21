import type { DatabaseSync } from "node:sqlite";
import path from "node:path";
import type { OpenClawConfig } from "../config/config.js";
import type {
  KnowledgeBaseEntry,
  KnowledgeBaseSettings,
  KnowledgeDocument,
  KnowledgeGraphRun,
} from "./knowledge-schema.js";
import { resolveAgentDir } from "../agents/agent-scope.js";
import { resolveKnowledgeConfig } from "../agents/knowledge-config.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { hashText } from "./internal.js";
import {
  extractTriplesViaLlm,
  hashTripleKey,
  writeTriplesJsonl,
  type KnowledgeGraphSettings,
  type KnowledgeGraphTripleInput,
} from "./knowledge-graph.js";
import { ProcessorRegistry, type ProcessorOptions } from "./knowledge-processor.js";
import { ensureKnowledgeSchema } from "./knowledge-schema.js";
import { KnowledgeStorageManager } from "./knowledge-storage.js";
import { MemoryIndexManager } from "./manager.js";
import { ensureMemoryIndexSchema } from "./memory-schema.js";

const log = createSubsystemLogger("knowledge");

export type UploadKnowledgeDocumentParams = {
  kbId?: string;
  filename: string;
  buffer: Buffer;
  mimetype: string;
  sourceType: "web_api" | "chat_attachment";
  sourceMetadata?: Record<string, unknown>;
  agentId: string;
  description?: string;
  tags?: string[];
};

export type UploadKnowledgeDocumentResult = {
  documentId: string;
  indexed: boolean;
};

export type UpdateKnowledgeDocumentParams = {
  kbId: string;
  documentId: string;
  filename: string;
  buffer: Buffer;
  mimetype: string;
  sourceType: "web_api" | "chat_attachment";
  sourceMetadata?: Record<string, unknown>;
  agentId: string;
  description?: string;
  tags?: string[];
};

export type UpdateKnowledgeDocumentResult = {
  documentId: string;
  filename: string;
  size: number;
  indexed: boolean;
  updatedAt: string;
};

export type UpdateKnowledgeDocumentMetadataParams = {
  kbId: string;
  documentId: string;
  agentId: string;
  filename?: string;
  description?: string | null;
  tags?: string[];
};

export type DeleteKnowledgeDocumentResult = {
  success: boolean;
};

export type ListKnowledgeDocumentsParams = {
  agentId: string;
  kbId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
};

export type KnowledgeDocumentWithTags = KnowledgeDocument & {
  tags: string[];
};

export type KnowledgeChunk = {
  id: string;
  index: number;
  text: string;
  tokens: number;
  sourcePage: number | null;
  status: "enabled";
};

export type KnowledgeChunkDetail = KnowledgeChunk & {
  documentId: string;
  startLine: number;
  endLine: number;
};

export type KnowledgeBaseCreateParams = {
  name: string;
  description?: string;
  icon?: string;
  visibility?: "private" | "team" | "public";
};

export type KnowledgeBaseUpdateParams = {
  kbId: string;
  name?: string;
  description?: string;
  icon?: string;
  visibility?: "private" | "team" | "public";
};

export type KnowledgeBaseDeleteResult = {
  success: boolean;
};

export type KnowledgeVectorizationSettings = {
  enabled: boolean;
  provider?: "openai" | "gemini" | "local" | "auto";
  model?: string;
};

export type KnowledgeGraphSettingsState = KnowledgeGraphSettings;

export type KnowledgeSettings = {
  vectorization: KnowledgeVectorizationSettings;
  graph: KnowledgeGraphSettingsState;
  updatedAt?: number;
};

export type UpdateKnowledgeSettingsParams = {
  vectorization?: Partial<KnowledgeVectorizationSettings>;
  graph?: Partial<KnowledgeGraphSettingsState>;
};

/**
 * High-level knowledge base manager coordinating storage, processing, and indexing
 */
export class KnowledgeManager {
  private cfg: OpenClawConfig;
  private db: DatabaseSync;
  private baseDir: string;
  private storage: KnowledgeStorageManager;
  private processorRegistry: ProcessorRegistry;
  private readonly embeddingCacheTable = "embedding_cache";
  private readonly ftsTable = "chunks_fts";

  constructor(params: { cfg: OpenClawConfig; db: DatabaseSync; baseDir: string }) {
    this.cfg = params.cfg;
    this.db = params.db;
    this.baseDir = params.baseDir;

    // Ensure schema exists
    ensureKnowledgeSchema(this.db);

    this.storage = new KnowledgeStorageManager(this.baseDir, this.db);
    this.processorRegistry = new ProcessorRegistry();
  }

  private ensureChunksSchema() {
    ensureMemoryIndexSchema({
      db: this.db,
      embeddingCacheTable: this.embeddingCacheTable,
      ftsTable: this.ftsTable,
      ftsEnabled: false,
    });
  }

  /**
   * Get knowledge configuration for an agent
   */
  getConfig(agentId: string) {
    return resolveKnowledgeConfig(this.cfg, agentId);
  }

  /**
   * Check if knowledge base is enabled for an agent
   */
  isEnabled(agentId: string): boolean {
    return this.getConfig(agentId) !== null;
  }

  createBase(params: { agentId: string } & KnowledgeBaseCreateParams): KnowledgeBaseEntry {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    const name = params.name.trim();
    if (!name) {
      throw new Error("name is required");
    }
    const visibility = params.visibility ?? "private";
    if (!isVisibility(visibility)) {
      throw new Error("visibility is invalid");
    }
    if (this.baseNameExists(params.agentId, name)) {
      throw new Error("Knowledge base name already exists");
    }
    const now = Date.now();
    const kbId = hashText(`${params.agentId}:${name}:${now}`);
    this.db
      .prepare(
        `INSERT INTO kb_bases (id, owner_agent_id, name, description, icon, visibility, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        kbId,
        params.agentId,
        name,
        params.description ?? null,
        params.icon ?? null,
        visibility,
        now,
        now,
      );
    return this.getBaseById(params.agentId, kbId) as KnowledgeBaseEntry;
  }

  listBases(params: {
    agentId: string;
    limit?: number;
    offset?: number;
    search?: string;
    visibility?: "private" | "team" | "public";
    tags?: string[];
  }): { total: number; returned: number; offset: number; kbs: KnowledgeBaseEntry[] } {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    const rows = this.listBaseEntries({
      agentId: params.agentId,
      search: params.search,
      visibility: params.visibility,
    });
    const offset = Math.max(0, params.offset ?? 0);
    const limit = Math.max(1, params.limit ?? 50);
    const paged = rows.slice(offset, offset + limit);
    return {
      total: rows.length,
      returned: paged.length,
      offset,
      kbs: paged,
    };
  }

  getBase(agentId: string, kbId?: string): KnowledgeBaseEntry | null {
    if (kbId) {
      return this.getBaseById(agentId, kbId);
    }
    const bases = this.listBaseEntries({ agentId });
    return bases.length === 1 ? bases[0] : null;
  }

  getBaseById(agentId: string, kbId: string): KnowledgeBaseEntry | null {
    const row = this.db
      .prepare(
        `SELECT id, owner_agent_id, name, description, icon, visibility, created_at, updated_at
         FROM kb_bases WHERE owner_agent_id = ? AND id = ?`,
      )
      .get(agentId, kbId) as KnowledgeBaseEntry | undefined;
    return row ?? null;
  }

  updateBase(params: { agentId: string } & KnowledgeBaseUpdateParams): KnowledgeBaseEntry {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    const base = this.getBaseById(params.agentId, params.kbId);
    if (!base) {
      throw new Error("Knowledge base not found");
    }
    if (params.visibility && !isVisibility(params.visibility)) {
      throw new Error("visibility is invalid");
    }
    const name = params.name?.trim() ?? base.name;
    if (!name) {
      throw new Error("name is required");
    }
    if (name !== base.name && this.baseNameExists(params.agentId, name, base.id)) {
      throw new Error("Knowledge base name already exists");
    }
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE kb_bases
         SET name = ?, description = ?, icon = ?, visibility = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        name,
        params.description ?? base.description ?? null,
        params.icon ?? base.icon ?? null,
        params.visibility ?? base.visibility,
        now,
        base.id,
      );
    return this.getBaseById(params.agentId, params.kbId) as KnowledgeBaseEntry;
  }

  deleteBase(params: { agentId: string; kbId: string }): KnowledgeBaseDeleteResult {
    const base = this.getBaseById(params.agentId, params.kbId);
    if (!base) {
      return { success: false };
    }
    this.db.prepare(`DELETE FROM kb_bases WHERE id = ?`).run(base.id);
    return { success: true };
  }

  getSettings(agentId: string): KnowledgeSettings {
    const config = this.getConfig(agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${agentId}`);
    }
    const row = this.db
      .prepare(
        `SELECT owner_agent_id, vector_config, graph_config, updated_at
         FROM kb_settings WHERE owner_agent_id = ?`,
      )
      .get(agentId) as KnowledgeBaseSettings | undefined;
    const vectorOverrides = row?.vector_config
      ? (JSON.parse(row.vector_config) as Partial<KnowledgeVectorizationSettings>)
      : {};
    const graphOverrides = row?.graph_config
      ? (JSON.parse(row.graph_config) as Partial<KnowledgeGraphSettingsState>)
      : {};
    const vectorization: KnowledgeVectorizationSettings = {
      ...config.vectorization,
      ...vectorOverrides,
    };
    const graph: KnowledgeGraphSettingsState = {
      ...config.graph,
      ...graphOverrides,
      extractor: "llm",
    };
    return {
      vectorization,
      graph,
      updatedAt: row?.updated_at,
    };
  }

  updateSettings(agentId: string, params: UpdateKnowledgeSettingsParams): KnowledgeSettings {
    const config = this.getConfig(agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${agentId}`);
    }
    const row = this.db
      .prepare(
        `SELECT owner_agent_id, vector_config, graph_config, updated_at
         FROM kb_settings WHERE owner_agent_id = ?`,
      )
      .get(agentId) as KnowledgeBaseSettings | undefined;
    const vectorOverrides = row?.vector_config
      ? (JSON.parse(row.vector_config) as Partial<KnowledgeVectorizationSettings>)
      : {};
    const graphOverrides = row?.graph_config
      ? (JSON.parse(row.graph_config) as Partial<KnowledgeGraphSettingsState>)
      : {};
    const nextVector = { ...vectorOverrides, ...params.vectorization };
    const nextGraph = { ...graphOverrides, ...params.graph };
    const updatedAt = Date.now();
    this.db
      .prepare(
        `INSERT INTO kb_settings (owner_agent_id, vector_config, graph_config, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(owner_agent_id) DO UPDATE SET
           vector_config=excluded.vector_config,
           graph_config=excluded.graph_config,
           updated_at=excluded.updated_at`,
      )
      .run(
        agentId,
        Object.keys(nextVector).length ? JSON.stringify(nextVector) : null,
        Object.keys(nextGraph).length ? JSON.stringify(nextGraph) : null,
        updatedAt,
      );
    return this.getSettings(agentId);
  }

  /**
   * Upload and index a knowledge document
   */
  async uploadDocument(
    params: UploadKnowledgeDocumentParams,
  ): Promise<UploadKnowledgeDocumentResult> {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    const kbId = this.resolveBaseIdForAgent({
      agentId: params.agentId,
      kbId: params.kbId,
    });

    // Validate file size
    if (params.buffer.byteLength > config.storage.maxFileSize) {
      throw new Error(
        `File too large: ${params.buffer.byteLength} bytes (limit: ${config.storage.maxFileSize} bytes)`,
      );
    }

    // Check document count limit
    const currentCount = this.storage.getDocumentCount({ agentId: params.agentId });
    if (currentCount >= config.storage.maxDocuments) {
      throw new Error(
        `Document limit reached: ${currentCount}/${config.storage.maxDocuments} documents`,
      );
    }

    // Validate MIME type
    const processor = this.processorRegistry.getProcessor(params.mimetype);
    const isPreviewOnly = !processor && isPreviewOnlyMimeType(params.mimetype);
    if (!processor && !isPreviewOnly) {
      throw new Error(`Unsupported document type: ${params.mimetype}`);
    }
    if (
      processor &&
      ((params.mimetype === "application/pdf" && !config.formats.pdf.enabled) ||
        (params.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
          !config.formats.docx.enabled) ||
        (params.mimetype === "application/msword" && !config.formats.docx.enabled) ||
        (params.mimetype === "text/plain" && !config.formats.txt.enabled) ||
        (params.mimetype === "text/markdown" && !config.formats.txt.enabled) ||
        (params.mimetype === "text/html" && !config.formats.html.enabled))
    ) {
      throw new Error(`Document type disabled by configuration: ${params.mimetype}`);
    }

    // Store document
    const storeResult = await this.storage.storeDocument({
      kbId,
      filename: params.filename,
      buffer: params.buffer,
      mimetype: params.mimetype,
      sourceType: params.sourceType,
      sourceMetadata: params.sourceMetadata,
      ownerAgentId: params.agentId,
      description: params.description,
      tags: params.tags,
    });

    log.info(
      `knowledge: stored document ${params.filename} (${storeResult.documentId}) for agent ${params.agentId}`,
    );

    // Extract text from document (if supported)
    let extractedText = "";
    if (processor) {
      try {
        const processorOptions: ProcessorOptions = {};
        if (params.mimetype === "application/pdf" && config.formats.pdf.maxPages) {
          processorOptions.maxPages = config.formats.pdf.maxPages;
        }

        extractedText = await processor.extract(params.buffer, processorOptions);
      } catch (err) {
        log.warn(`knowledge: failed to extract text from ${params.filename}: ${String(err)}`);
        throw new Error(`Failed to extract text from document: ${String(err)}`, {
          cause: err,
        });
      }

      if (!extractedText || extractedText.trim().length === 0) {
        log.warn(`knowledge: no text extracted from ${params.filename}`);
        throw new Error("No text content could be extracted from the document");
      }
    }

    // Index document if auto-indexing is enabled
    let indexed = false;
    const settings = this.getSettings(params.agentId);
    if (config.search.autoIndex && extractedText) {
      if (config.search.includeInMemorySearch && settings.vectorization.enabled) {
        try {
          const memoryManager = await MemoryIndexManager.get({
            cfg: this.cfg,
            agentId: params.agentId,
            overrides: {
              provider: settings.vectorization.provider,
              model: settings.vectorization.model,
            },
          });

          if (memoryManager) {
            await memoryManager.ingestKnowledgeDocument({
              documentId: storeResult.documentId,
              filename: params.filename,
              content: extractedText,
            });
            indexed = true;
          } else {
            log.warn(
              `knowledge: memory index unavailable for agent ${params.agentId}, skipping indexing`,
            );
          }
        } catch (err) {
          log.warn(
            `knowledge: failed to index document ${storeResult.documentId} for agent ${params.agentId}: ${String(
              err,
            )}`,
          );
        }
      }
      if (indexed) {
        this.storage.updateIndexedAt(storeResult.documentId);
      }
    }

    if (settings.graph.enabled && extractedText) {
      try {
        await this.extractGraphForDocument({
          agentId: params.agentId,
          documentId: storeResult.documentId,
          content: extractedText,
          settings: settings.graph,
          kbId,
        });
      } catch (err) {
        log.warn(
          `knowledge: graph extraction failed for ${storeResult.documentId}: ${String(err)}`,
        );
      }
    }

    return {
      documentId: storeResult.documentId,
      indexed,
    };
  }

  /**
   * Update (overwrite) a knowledge document while preserving its documentId
   */
  async updateDocument(
    params: UpdateKnowledgeDocumentParams,
  ): Promise<UpdateKnowledgeDocumentResult> {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    const kbId = this.resolveBaseIdForAgent({
      agentId: params.agentId,
      kbId: params.kbId,
    });

    const doc = this.storage.getDocument(params.documentId);
    if (!doc) {
      throw new Error(`Document not found: ${params.documentId}`);
    }
    if (doc.owner_agent_id !== params.agentId) {
      throw new Error("Document does not belong to this agent");
    }
    if (doc.kb_id && doc.kb_id !== kbId) {
      throw new Error("Document does not belong to this knowledge base");
    }

    if (params.buffer.byteLength > config.storage.maxFileSize) {
      throw new Error(
        `File too large: ${params.buffer.byteLength} bytes (limit: ${config.storage.maxFileSize} bytes)`,
      );
    }

    const processor = this.processorRegistry.getProcessor(params.mimetype);
    const isPreviewOnly = !processor && isPreviewOnlyMimeType(params.mimetype);
    if (!processor && !isPreviewOnly) {
      throw new Error(`Unsupported document type: ${params.mimetype}`);
    }
    if (
      processor &&
      ((params.mimetype === "application/pdf" && !config.formats.pdf.enabled) ||
        (params.mimetype ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
          !config.formats.docx.enabled) ||
        (params.mimetype === "application/msword" && !config.formats.docx.enabled) ||
        (params.mimetype === "text/plain" && !config.formats.txt.enabled) ||
        (params.mimetype === "text/markdown" && !config.formats.txt.enabled) ||
        (params.mimetype === "text/html" && !config.formats.html.enabled))
    ) {
      throw new Error(`Document type disabled by configuration: ${params.mimetype}`);
    }

    const storeResult = await this.storage.updateDocument({
      kbId,
      documentId: params.documentId,
      filename: params.filename,
      buffer: params.buffer,
      mimetype: params.mimetype,
      sourceType: params.sourceType,
      sourceMetadata: params.sourceMetadata,
      ownerAgentId: params.agentId,
      description: params.description,
      tags: params.tags,
    });

    log.info(
      `knowledge: updated document ${params.filename} (${params.documentId}) for agent ${params.agentId}`,
    );

    let extractedText = "";
    if (processor) {
      try {
        const processorOptions: ProcessorOptions = {};
        if (params.mimetype === "application/pdf" && config.formats.pdf.maxPages) {
          processorOptions.maxPages = config.formats.pdf.maxPages;
        }
        extractedText = await processor.extract(params.buffer, processorOptions);
      } catch (err) {
        log.warn(`knowledge: failed to extract text from ${params.filename}: ${String(err)}`);
        throw new Error(`Failed to extract text from document: ${String(err)}`, {
          cause: err,
        });
      }

      if (!extractedText || extractedText.trim().length === 0) {
        log.warn(`knowledge: no text extracted from ${params.filename}`);
        throw new Error("No text content could be extracted from the document");
      }
    }

    if (config.search.includeInMemorySearch) {
      try {
        const memoryManager = await MemoryIndexManager.get({
          cfg: this.cfg,
          agentId: params.agentId,
          overrides: {
            provider: this.getSettings(params.agentId).vectorization.provider,
            model: this.getSettings(params.agentId).vectorization.model,
          },
        });
        if (memoryManager) {
          memoryManager.deleteKnowledgeDocument(params.documentId);
        }
      } catch (err) {
        log.warn(
          `knowledge: failed to remove document from index for agent ${params.agentId}: ${String(err)}`,
        );
      }
    }

    this.deleteGraphEntries({ agentId: params.agentId, documentId: params.documentId, kbId });

    let indexed = false;
    const settings = this.getSettings(params.agentId);
    if (config.search.autoIndex && extractedText) {
      if (config.search.includeInMemorySearch && settings.vectorization.enabled) {
        try {
          const memoryManager = await MemoryIndexManager.get({
            cfg: this.cfg,
            agentId: params.agentId,
            overrides: {
              provider: settings.vectorization.provider,
              model: settings.vectorization.model,
            },
          });

          if (memoryManager) {
            await memoryManager.ingestKnowledgeDocument({
              documentId: params.documentId,
              filename: params.filename,
              content: extractedText,
            });
            indexed = true;
          } else {
            log.warn(
              `knowledge: memory index unavailable for agent ${params.agentId}, skipping indexing`,
            );
          }
        } catch (err) {
          log.warn(
            `knowledge: failed to index document ${params.documentId} for agent ${params.agentId}: ${String(
              err,
            )}`,
          );
        }
      }
      if (indexed) {
        this.storage.updateIndexedAt(params.documentId);
      }
    }

    if (settings.graph.enabled && extractedText) {
      try {
        await this.extractGraphForDocument({
          agentId: params.agentId,
          documentId: params.documentId,
          content: extractedText,
          settings: settings.graph,
          kbId,
        });
      } catch (err) {
        log.warn(`knowledge: graph extraction failed for ${params.documentId}: ${String(err)}`);
      }
    }

    return {
      documentId: params.documentId,
      filename: params.filename,
      size: storeResult.size,
      indexed,
      updatedAt: new Date(storeResult.updatedAt).toISOString(),
    };
  }

  updateDocumentMetadata(params: UpdateKnowledgeDocumentMetadataParams): KnowledgeDocumentWithTags {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    const kbId = this.resolveBaseIdForAgent({
      agentId: params.agentId,
      kbId: params.kbId,
    });

    const doc = this.storage.getDocument(params.documentId);
    if (!doc) {
      throw new Error(`Document not found: ${params.documentId}`);
    }
    if (doc.owner_agent_id !== params.agentId) {
      throw new Error("Document does not belong to this agent");
    }
    if (doc.kb_id && doc.kb_id !== kbId) {
      throw new Error("Document does not belong to this knowledge base");
    }

    this.storage.updateDocumentMetadata({
      documentId: params.documentId,
      filename: params.filename,
      description: params.description,
      tags: params.tags,
    });

    const updated = this.storage.getDocument(params.documentId);
    if (!updated) {
      throw new Error(`Document not found after update: ${params.documentId}`);
    }

    return {
      ...updated,
      tags: this.storage.getDocumentTags(updated.id),
    };
  }

  /**
   * Delete a knowledge document
   */
  async deleteDocument(params: {
    documentId: string;
    agentId: string;
    kbId?: string;
  }): Promise<DeleteKnowledgeDocumentResult> {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }

    const doc = this.storage.getDocument(params.documentId);
    if (!doc) {
      return { success: false };
    }

    // Verify ownership against shared storage agent
    if (doc.owner_agent_id !== params.agentId) {
      throw new Error("Document does not belong to this agent");
    }
    if (params.kbId && doc.kb_id && params.kbId !== doc.kb_id) {
      throw new Error("Document does not belong to this knowledge base");
    }

    // Remove from index
    if (config.search.includeInMemorySearch) {
      try {
        const memoryManager = await MemoryIndexManager.get({
          cfg: this.cfg,
          agentId: params.agentId,
          overrides: {
            provider: this.getSettings(params.agentId).vectorization.provider,
            model: this.getSettings(params.agentId).vectorization.model,
          },
        });

        if (memoryManager) {
          memoryManager.deleteKnowledgeDocument(params.documentId);
        }
      } catch (err) {
        log.warn(
          `knowledge: failed to remove document from index for agent ${params.agentId}: ${String(err)}`,
        );
        // Continue with deletion even if index removal fails
      }
    }

    // Delete from storage
    await this.storage.deleteDocument(params.documentId);
    this.deleteGraphEntries({
      agentId: params.agentId,
      documentId: params.documentId,
      kbId: doc.kb_id ?? params.kbId ?? undefined,
    });

    log.info(`knowledge: deleted document ${params.documentId} for agent ${params.agentId}`);

    return { success: true };
  }

  /**
   * List knowledge documents for an agent
   */
  listDocuments(params: ListKnowledgeDocumentsParams): KnowledgeDocumentWithTags[] {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    if (params.kbId) {
      this.resolveBaseIdForAgent({ agentId: params.agentId, kbId: params.kbId });
    }

    const documents = this.storage.listDocuments({
      agentId: params.agentId,
      kbId: params.kbId,
      tags: params.tags,
      limit: params.limit,
      offset: params.offset,
    });

    return documents.map((doc) => ({
      ...doc,
      tags: this.storage.getDocumentTags(doc.id),
    }));
  }

  getGraphRun(params: {
    agentId: string;
    documentId: string;
    kbId?: string;
  }): KnowledgeGraphRun | null {
    const kbId = this.resolveDocumentKbId({
      agentId: params.agentId,
      documentId: params.documentId,
      kbId: params.kbId,
    });
    const row = this.db
      .prepare(
        `SELECT id, kb_id, document_id, status, triples_path, extractor, model, error,
                created_at, updated_at
         FROM knowledge_graph_runs WHERE kb_id = ? AND document_id = ?`,
      )
      .get(kbId, params.documentId) as KnowledgeGraphRun | undefined;
    return row ?? null;
  }

  getGraphStats(params: { agentId: string; kbId?: string }): {
    totalTriples: number;
    totalEntities: number;
  } {
    const kbId = this.resolveBaseIdForAgent({
      agentId: params.agentId,
      kbId: params.kbId,
    });
    const triplesRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM knowledge_graph_triples WHERE kb_id = ?`)
      .get(kbId) as { count: number };
    const entitiesRow = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM (
           SELECT h as name FROM knowledge_graph_triples WHERE kb_id = ?
           UNION
           SELECT t as name FROM knowledge_graph_triples WHERE kb_id = ?
         )`,
      )
      .get(kbId, kbId) as { count: number };
    return {
      totalTriples: triplesRow?.count ?? 0,
      totalEntities: entitiesRow?.count ?? 0,
    };
  }

  queryGraphSubgraph(params: {
    agentId: string;
    keyword: string;
    kbId?: string;
    documentIds?: string[];
    relation?: string;
    entityPrefix?: string;
    createdAfter?: number;
    createdBefore?: number;
    minDegree?: number;
    maxDepth?: number;
    maxTriples?: number;
  }): {
    nodes: Array<{ id: string; name: string }>;
    edges: Array<{ id: string; source: string; target: string; type: string; score?: number }>;
  } {
    const kbId = this.resolveGraphKbId({
      agentId: params.agentId,
      kbId: params.kbId,
      documentIds: params.documentIds,
    });
    const keyword = params.keyword.trim();
    if (!keyword && !(params.documentIds?.length || params.relation || params.entityPrefix)) {
      return { nodes: [], edges: [] };
    }
    const maxDepth = Math.max(1, params.maxDepth ?? 2);
    const maxTriples = Math.max(10, params.maxTriples ?? 200);
    const filter = buildGraphFilter({
      kbId,
      keyword,
      documentIds: params.documentIds,
      relation: params.relation,
      entityPrefix: params.entityPrefix,
      createdAfter: params.createdAfter,
      createdBefore: params.createdBefore,
    });
    const seedTriples = this.fetchSeedTriples({
      filter,
      keyword,
      limit: maxTriples,
    });
    const triples: Array<{ h: string; r: string; t: string; score?: number }> = [...seedTriples];
    let frontier = new Set<string>();
    for (const triple of seedTriples) {
      frontier.add(triple.h);
      frontier.add(triple.t);
    }
    for (let depth = 1; depth < maxDepth; depth++) {
      if (frontier.size === 0 || triples.length >= maxTriples) {
        break;
      }
      const entities = Array.from(frontier);
      frontier = new Set<string>();
      const placeholders = entities.map(() => "?").join(", ");
      const rows = this.db
        .prepare(
          `SELECT h, r, t FROM knowledge_graph_triples
         WHERE kb_id = ? AND (h IN (${placeholders}) OR t IN (${placeholders}))
         ${filter.extraSqlTriples}
         LIMIT ?`,
        )
        .all(kbId, ...entities, ...entities, ...filter.extraParams, maxTriples) as Array<{
        h: string;
        r: string;
        t: string;
      }>;
      for (const row of rows) {
        if (triples.length >= maxTriples) {
          break;
        }
        triples.push(row);
        frontier.add(row.h);
        frontier.add(row.t);
      }
    }
    const minDegree = Math.max(0, params.minDegree ?? 0);
    const degreeMap = new Map<string, number>();
    for (const triple of triples) {
      degreeMap.set(triple.h, (degreeMap.get(triple.h) ?? 0) + 1);
      degreeMap.set(triple.t, (degreeMap.get(triple.t) ?? 0) + 1);
    }
    const nodesMap = new Map<string, { id: string; name: string }>();
    const edges: Array<{
      id: string;
      source: string;
      target: string;
      type: string;
      score?: number;
    }> = [];
    for (const triple of triples) {
      if ((degreeMap.get(triple.h) ?? 0) < minDegree) {
        continue;
      }
      if ((degreeMap.get(triple.t) ?? 0) < minDegree) {
        continue;
      }
      const hId = hashText(triple.h);
      const tId = hashText(triple.t);
      nodesMap.set(triple.h, { id: hId, name: triple.h });
      nodesMap.set(triple.t, { id: tId, name: triple.t });
      edges.push({
        id: hashText(`${triple.h}::${triple.r}::${triple.t}`),
        source: hId,
        target: tId,
        type: triple.r,
        score: triple.score,
      });
    }
    return { nodes: Array.from(nodesMap.values()), edges };
  }

  private async extractGraphForDocument(params: {
    agentId: string;
    documentId: string;
    content: string;
    settings: KnowledgeGraphSettingsState;
    kbId: string;
  }): Promise<void> {
    const kbId = params.kbId;
    const runId = hashText(`${kbId}:${params.documentId}`);
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO knowledge_graph_runs
         (id, kb_id, document_id, status, extractor, model, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status=excluded.status,
           updated_at=excluded.updated_at`,
      )
      .run(
        runId,
        kbId,
        params.documentId,
        "running",
        params.settings.extractor,
        params.settings.model ?? null,
        now,
        now,
      );
    try {
      const extractResult = await extractTriplesViaLlm({
        text: params.content,
        settings: params.settings,
        cfg: this.cfg,
        agentId: params.agentId,
        workspaceDir: this.baseDir,
        agentDir: resolveAgentDir(this.cfg, params.agentId),
      });
      const triples = extractResult.triples
        .map((triple) => normalizeTripleOrNull(triple))
        .filter((triple): triple is KnowledgeGraphTripleInput => Boolean(triple));
      const triplesPath = path.join(
        this.baseDir,
        "knowledge",
        "graphs",
        kbId,
        "triples",
        `${params.documentId}.jsonl`,
      );
      await writeTriplesJsonl({ filePath: triplesPath, triples });
      this.deleteGraphEntries({
        agentId: params.agentId,
        documentId: params.documentId,
        kbId,
      });
      const insertTriple = this.db.prepare(
        `INSERT INTO knowledge_graph_triples (id, kb_id, document_id, h, r, t, props_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertFts = this.buildGraphFtsInsert();
      for (const triple of triples) {
        const h = typeof triple.h === "string" ? triple.h : triple.h.name;
        const t = typeof triple.t === "string" ? triple.t : triple.t.name;
        const r = typeof triple.r === "string" ? triple.r : triple.r.type;
        const props = JSON.stringify({
          h: typeof triple.h === "string" ? undefined : triple.h,
          r: typeof triple.r === "string" ? undefined : triple.r,
          t: typeof triple.t === "string" ? undefined : triple.t,
        });
        const tripleId = hashTripleKey(triple);
        insertTriple.run(tripleId, kbId, params.documentId, h, r, t, props, Date.now());
        if (insertFts) {
          insertFts.run([h, r, t].join(" "), tripleId, kbId, params.documentId, h, r, t);
        }
      }
      this.db
        .prepare(
          `UPDATE knowledge_graph_runs
           SET status = ?, triples_path = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run("success", triplesPath, Date.now(), runId);
    } catch (err) {
      this.db
        .prepare(
          `UPDATE knowledge_graph_runs
           SET status = ?, error = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run("failed", String(err), Date.now(), runId);
      throw err;
    }
  }

  private deleteGraphEntries(params: { agentId: string; documentId: string; kbId?: string }): void {
    const kbId =
      params.kbId ??
      this.resolveDocumentKbId({
        agentId: params.agentId,
        documentId: params.documentId,
        kbId: params.kbId,
      });
    this.db
      .prepare(`DELETE FROM knowledge_graph_triples WHERE kb_id = ? AND document_id = ?`)
      .run(kbId, params.documentId);
    this.db
      .prepare(`DELETE FROM knowledge_graph_runs WHERE kb_id = ? AND document_id = ?`)
      .run(kbId, params.documentId);
    if (this.hasGraphFts()) {
      this.db
        .prepare(`DELETE FROM knowledge_graph_fts WHERE kb_id = ? AND document_id = ?`)
        .run(kbId, params.documentId);
    }
  }

  private hasGraphFts(): boolean {
    const row = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE name = 'knowledge_graph_fts'`)
      .get() as { name?: string } | undefined;
    return Boolean(row?.name);
  }

  private buildGraphFtsInsert() {
    if (!this.hasGraphFts()) {
      return null;
    }
    return this.db.prepare(
      `INSERT INTO knowledge_graph_fts (content, triple_id, kb_id, document_id, h, r, t)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
  }

  private fetchSeedTriples(params: {
    filter: GraphFilter;
    keyword: string;
    limit: number;
  }): Array<{ h: string; r: string; t: string; score?: number }> {
    const { filter, keyword, limit } = params;
    if (keyword && this.hasGraphFts()) {
      const rows = this.db
        .prepare(
          `SELECT t.h as h, t.r as r, t.t as t, bm25(knowledge_graph_fts) as rank
           FROM knowledge_graph_fts f
           JOIN knowledge_graph_triples t ON t.id = f.triple_id
           WHERE f.kb_id = ? AND knowledge_graph_fts MATCH ? ${filter.docFilterSql}
           ${filter.extraSqlJoin}
           ORDER BY rank ASC
           LIMIT ?`,
        )
        .all(
          filter.kbId,
          keyword,
          ...filter.docFilterParams,
          ...filter.extraParams,
          limit,
        ) as Array<{ h: string; r: string; t: string; rank: number }>;
      return rows.map((row) => ({
        h: row.h,
        r: row.r,
        t: row.t,
        score: 1 / (1 + Math.max(0, row.rank)),
      }));
    }
    const like = `%${keyword}%`;
    const rows = this.db
      .prepare(
        `SELECT h, r, t FROM knowledge_graph_triples
         WHERE kb_id = ? AND (h LIKE ? OR t LIKE ? OR r LIKE ?)
         ${filter.extraSqlTriples}
         LIMIT ?`,
      )
      .all(filter.kbId, like, like, like, ...filter.extraParams, limit) as Array<{
      h: string;
      r: string;
      t: string;
    }>;
    return rows.map((row) => ({
      h: row.h,
      r: row.r,
      t: row.t,
      score: scoreTextMatch({ h: row.h, r: row.r, t: row.t }, keyword),
    }));
  }

  listChunks(params: {
    agentId: string;
    documentId: string;
    kbId?: string;
    limit?: number;
    offset?: number;
  }): { total: number; returned: number; offset: number; chunks: KnowledgeChunk[] } {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    this.ensureChunksSchema();
    const doc = this.storage.getDocument(params.documentId);
    if (!doc) {
      throw new Error(`Document not found: ${params.documentId}`);
    }
    if (doc.owner_agent_id !== params.agentId) {
      throw new Error("Document does not belong to this agent");
    }
    if (params.kbId && doc.kb_id && params.kbId !== doc.kb_id) {
      throw new Error("Document does not belong to this knowledge base");
    }
    const limit = Math.max(1, params.limit ?? 50);
    const offset = Math.max(0, params.offset ?? 0);
    const pathKey = `knowledge/${params.documentId}`;
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) as count FROM chunks WHERE path = ? AND source = 'knowledge'`)
      .get(pathKey) as { count: number };
    const rows = this.db
      .prepare(
        `SELECT id, text, start_line, end_line
         FROM chunks
         WHERE path = ? AND source = 'knowledge'
         ORDER BY start_line ASC
         LIMIT ? OFFSET ?`,
      )
      .all(pathKey, limit, offset) as Array<{
      id: string;
      text: string;
      start_line: number;
      end_line: number;
    }>;
    const chunks = rows.map((row, idx) => ({
      id: row.id,
      index: offset + idx + 1,
      text: row.text,
      tokens: estimateTokens(row.text),
      sourcePage: null,
      status: "enabled" as const,
    }));
    return {
      total: totalRow?.count ?? 0,
      returned: chunks.length,
      offset,
      chunks,
    };
  }

  getChunk(params: {
    agentId: string;
    chunkId: string;
    kbId?: string;
  }): KnowledgeChunkDetail | null {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }
    this.ensureChunksSchema();
    const row = this.db
      .prepare(
        `SELECT id, path, text, start_line, end_line
         FROM chunks
         WHERE id = ? AND source = 'knowledge'`,
      )
      .get(params.chunkId) as
      | { id: string; path: string; text: string; start_line: number; end_line: number }
      | undefined;
    if (!row) {
      return null;
    }
    const documentId = row.path.replace(/^knowledge\//, "");
    const doc = this.storage.getDocument(documentId);
    if (!doc) {
      return null;
    }
    if (doc.owner_agent_id !== params.agentId) {
      throw new Error("Document does not belong to this agent");
    }
    if (params.kbId && doc.kb_id && params.kbId !== doc.kb_id) {
      throw new Error("Document does not belong to this knowledge base");
    }
    const indexRow = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM chunks
         WHERE path = ? AND source = 'knowledge' AND start_line <= ?`,
      )
      .get(row.path, row.start_line) as { count: number };
    return {
      id: row.id,
      documentId,
      index: indexRow?.count ?? 0,
      text: row.text,
      tokens: estimateTokens(row.text),
      sourcePage: null,
      status: "enabled",
      startLine: row.start_line,
      endLine: row.end_line,
    };
  }

  /**
   * Get a single document with tags
   */
  getDocument(params: {
    documentId: string;
    agentId: string;
    kbId?: string;
  }): KnowledgeDocumentWithTags | null {
    const config = this.getConfig(params.agentId);
    if (!config) {
      throw new Error(`Knowledge base is disabled for agent ${params.agentId}`);
    }

    const doc = this.storage.getDocument(params.documentId);
    if (!doc) {
      return null;
    }

    // Verify ownership against shared storage agent
    if (doc.owner_agent_id !== params.agentId) {
      throw new Error("Document does not belong to this agent");
    }
    if (params.kbId && doc.kb_id && params.kbId !== doc.kb_id) {
      throw new Error("Document does not belong to this knowledge base");
    }

    return {
      ...doc,
      tags: this.storage.getDocumentTags(doc.id),
    };
  }

  /**
   * Get document count for an agent
   */
  getDocumentCount(params: { agentId: string; kbId?: string }): number {
    const config = this.getConfig(params.agentId);
    if (!config) {
      return 0;
    }

    return this.storage.getDocumentCount({ agentId: params.agentId, kbId: params.kbId });
  }

  resolveDocumentPath(params: { agentId: string; documentId: string; kbId?: string }): {
    absPath: string;
    mimetype: string;
  } {
    const doc = this.getDocument({
      agentId: params.agentId,
      documentId: params.documentId,
      kbId: params.kbId,
    });
    if (!doc) {
      throw new Error(`Document not found: ${params.documentId}`);
    }
    return {
      absPath: path.join(this.baseDir, doc.filepath),
      mimetype: doc.mimetype,
    };
  }

  private baseNameExists(agentId: string, name: string, excludeId?: string): boolean {
    const row = this.db
      .prepare(`SELECT id FROM kb_bases WHERE owner_agent_id = ? AND name = ? LIMIT 1`)
      .get(agentId, name) as { id: string } | undefined;
    if (!row) {
      return false;
    }
    return excludeId ? row.id !== excludeId : true;
  }

  private listBaseEntries(params: {
    agentId: string;
    search?: string;
    visibility?: "private" | "team" | "public";
  }): KnowledgeBaseEntry[] {
    const conditions: string[] = ["owner_agent_id = ?"];
    const values: (string | number)[] = [params.agentId];
    if (params.visibility) {
      conditions.push("visibility = ?");
      values.push(params.visibility);
    }
    if (params.search) {
      conditions.push("(name LIKE ? OR description LIKE ?)");
      const like = `%${params.search}%`;
      values.push(like, like);
    }
    const rows = this.db
      .prepare(
        `SELECT id, owner_agent_id, name, description, icon, visibility, created_at, updated_at
         FROM kb_bases WHERE ${conditions.join(" AND ")}
         ORDER BY updated_at DESC`,
      )
      .all(...values) as KnowledgeBaseEntry[];
    return rows;
  }

  private resolveBaseIdForAgent(params: { agentId: string; kbId?: string | null }): string {
    if (params.kbId) {
      const base = this.getBaseById(params.agentId, params.kbId);
      if (!base) {
        throw new Error("Knowledge base not found");
      }
      return base.id;
    }
    const bases = this.listBaseEntries({ agentId: params.agentId });
    if (bases.length === 1) {
      return bases[0].id;
    }
    if (bases.length === 0) {
      throw new Error("Knowledge base not found");
    }
    throw new Error("kbId is required");
  }

  private resolveDocumentKbId(params: {
    agentId: string;
    documentId: string;
    kbId?: string;
  }): string {
    const doc = this.storage.getDocument(params.documentId);
    if (!doc) {
      throw new Error(`Document not found: ${params.documentId}`);
    }
    if (doc.owner_agent_id !== params.agentId) {
      throw new Error("Document does not belong to this agent");
    }
    if (params.kbId && doc.kb_id && params.kbId !== doc.kb_id) {
      throw new Error("Document does not belong to this knowledge base");
    }
    return doc.kb_id ?? params.kbId ?? this.resolveBaseIdForAgent({ agentId: params.agentId });
  }

  private resolveGraphKbId(params: {
    agentId: string;
    kbId?: string;
    documentIds?: string[];
  }): string {
    if (params.kbId) {
      this.resolveBaseIdForAgent({ agentId: params.agentId, kbId: params.kbId });
      if (params.documentIds?.length) {
        for (const documentId of params.documentIds) {
          const doc = this.storage.getDocument(documentId);
          if (!doc) {
            throw new Error(`Document not found: ${documentId}`);
          }
          if (doc.owner_agent_id !== params.agentId) {
            throw new Error("Document does not belong to this agent");
          }
          if (doc.kb_id && doc.kb_id !== params.kbId) {
            throw new Error("Document does not belong to this knowledge base");
          }
        }
      }
      return params.kbId;
    }
    if (params.documentIds?.length) {
      let resolved: string | undefined;
      for (const documentId of params.documentIds) {
        const doc = this.storage.getDocument(documentId);
        if (!doc) {
          throw new Error(`Document not found: ${documentId}`);
        }
        if (doc.owner_agent_id !== params.agentId) {
          throw new Error("Document does not belong to this agent");
        }
        if (doc.kb_id) {
          if (!resolved) {
            resolved = doc.kb_id;
          } else if (resolved !== doc.kb_id) {
            throw new Error("Documents belong to different knowledge bases");
          }
        }
      }
      if (resolved) {
        return resolved;
      }
    }
    return this.resolveBaseIdForAgent({ agentId: params.agentId });
  }
}

function normalizeTripleOrNull(
  triple: KnowledgeGraphTripleInput,
): KnowledgeGraphTripleInput | null {
  const h = typeof triple.h === "string" ? { name: triple.h } : triple.h;
  const t = typeof triple.t === "string" ? { name: triple.t } : triple.t;
  const r = typeof triple.r === "string" ? { type: triple.r } : triple.r;
  if (!h?.name || !t?.name || !r?.type) {
    return null;
  }
  return { h, r, t };
}

function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

function isVisibility(value: string): value is "private" | "team" | "public" {
  return value === "private" || value === "team" || value === "public";
}

type GraphFilter = {
  kbId: string;
  keyword: string;
  extraSqlTriples: string;
  extraSqlJoin: string;
  extraParams: Array<string | number>;
  docFilterSql: string;
  docFilterParams: Array<string>;
};

function buildGraphFilter(params: {
  kbId: string;
  keyword: string;
  documentIds?: string[];
  relation?: string;
  entityPrefix?: string;
  createdAfter?: number;
  createdBefore?: number;
}): GraphFilter {
  const extraTriples: string[] = [];
  const extraJoin: string[] = [];
  const extraParams: Array<string | number> = [];
  if (params.documentIds && params.documentIds.length > 0) {
    const placeholders = params.documentIds.map(() => "?").join(", ");
    extraTriples.push(`document_id IN (${placeholders})`);
    extraJoin.push(`t.document_id IN (${placeholders})`);
    extraParams.push(...params.documentIds);
  }
  if (params.relation) {
    extraTriples.push(`r = ?`);
    extraJoin.push(`t.r = ?`);
    extraParams.push(params.relation);
  }
  if (params.entityPrefix) {
    extraTriples.push(`(h LIKE ? OR t LIKE ?)`);
    extraJoin.push(`(t.h LIKE ? OR t.t LIKE ?)`);
    extraParams.push(`${params.entityPrefix}%`, `${params.entityPrefix}%`);
  }
  if (typeof params.createdAfter === "number") {
    extraTriples.push(`created_at >= ?`);
    extraJoin.push(`t.created_at >= ?`);
    extraParams.push(params.createdAfter);
  }
  if (typeof params.createdBefore === "number") {
    extraTriples.push(`created_at <= ?`);
    extraJoin.push(`t.created_at <= ?`);
    extraParams.push(params.createdBefore);
  }
  const extraSqlTriples = extraTriples.length ? `AND ${extraTriples.join(" AND ")}` : "";
  const extraSqlJoin = extraJoin.length ? `AND ${extraJoin.join(" AND ")}` : "";
  const docFilterSql =
    params.documentIds && params.documentIds.length
      ? `AND f.document_id IN (${params.documentIds.map(() => "?").join(", ")})`
      : "";
  const docFilterParams = params.documentIds ?? [];
  return {
    kbId: params.kbId,
    keyword: params.keyword,
    extraSqlTriples,
    extraSqlJoin,
    extraParams,
    docFilterSql,
    docFilterParams,
  };
}

function scoreTextMatch(triple: { h: string; r: string; t: string }, keyword: string): number {
  const needle = keyword.toLowerCase();
  const text = `${triple.h} ${triple.r} ${triple.t}`.toLowerCase();
  if (text === needle) {
    return 1;
  }
  if (text.includes(needle)) {
    return 0.7;
  }
  return 0.3;
}

function isPreviewOnlyMimeType(mimetype: string): boolean {
  if (mimetype.startsWith("image/")) {
    return true;
  }
  if (mimetype.startsWith("audio/")) {
    return true;
  }
  if (mimetype.startsWith("video/")) {
    return true;
  }
  return (
    mimetype === "text/csv" ||
    mimetype === "application/csv" ||
    mimetype === "application/json" ||
    mimetype === "application/vnd.ms-powerpoint" ||
    mimetype === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimetype === "application/vnd.openxmlformats-officedocument.presentationml.slideshow" ||
    mimetype === "application/vnd.ms-powerpoint.presentation.macroenabled.12" ||
    mimetype === "application/vnd.ms-excel" ||
    mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimetype === "application/vnd.ms-excel.sheet.macroenabled.12"
  );
}
