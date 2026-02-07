# Knowledge Base Management System - Implementation Plan

## Overview

Add comprehensive knowledge base management to Moltbot with multi-format document upload, vectorization indexing, and intelligent retrieval.

**Core Strategy**: Extend existing Memory system, reusing embedding infrastructure, SQLite storage, and hybrid search capabilities.

---

## Requirements Summary

✅ **Upload Channels**: Web API + Chat Message Attachments
✅ **Document Formats**: PDF, DOCX/DOC, TXT/Markdown, HTML/Web Pages
✅ **Query Trigger**: AI automatic decision (as tool invocation)
✅ **Metadata Management**: Document management API + Tag classification + Basic storage
❌ **Permission Control**: Not implemented (simplified to single-agent isolation)

---

## Vectorization Flow Explanation

### Existing Memory System Vectorization

In `src/memory/manager.ts`, vectorization is implemented through this call chain:

```typescript
// manager.ts:2134-2144
async indexFile(entry: MemoryFileEntry, options: { source: MemorySource }) {
  const content = await fs.readFile(entry.absPath, "utf-8");

  // 1. Chunk content (reuse existing logic)
  const chunks = chunkMarkdown(content, this.settings.chunking);

  // 2. Vectorize (key call)
  const embeddings = this.batch.enabled
    ? await this.embedChunksWithBatch(chunks, entry, options.source)  // Batch mode
    : await this.embedChunksInBatches(chunks);                       // Streaming mode

  // 3. Store to SQLite
  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    this.insertChunk({ ...chunks[i], source, embedding });
  }
}
```

**Key Method** (`manager.ts:1691-1727`):

```typescript
private async embedChunksInBatches(chunks: MemoryChunk[]): Promise<number[][]> {
  // 1. Load cache
  const cached = this.loadEmbeddingCache(chunks.map(c => c.hash));

  // 2. Identify missing chunks
  const missing: MemoryChunk[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (!cached.get(chunks[i].hash)) {
      missing.push(chunks[i]);
    }
  }

  // 3. Batch generate embeddings
  const batches = this.buildEmbeddingBatches(missing);
  for (const batch of batches) {
    const batchEmbeddings = await this.embedBatchWithRetry(batch.map(c => c.text));
    // Cache results
    this.upsertEmbeddingCache(batch.map((c, i) => ({
      hash: c.hash,
      embedding: batchEmbeddings[i]
    })));
  }

  return embeddings;
}

// manager.ts:1921-1953
private async embedBatchWithRetry(texts: string[]): Promise<number[][]> {
  let attempt = 0;
  while (true) {
    try {
      // Call provider.embedBatch() - actual API call
      return await this.provider.embedBatch(texts);
    } catch (err) {
      if (!this.isRetryableEmbeddingError(err) || attempt >= MAX_ATTEMPTS) {
        throw err;
      }
      // Exponential backoff retry
      await sleep(delayMs);
      attempt += 1;
    }
  }
}
```

### Knowledge Base Document Vectorization Integration

We'll add new methods to reuse existing flow:

```typescript
// manager.ts (new method)
async ingestKnowledgeDocument(params: {
  documentId: string;
  text: string;
  filepath: string;
  metadata: { hash: string; size: number };
}): Promise<void> {
  // 1. Chunk text (reuse existing chunkMarkdown)
  const chunks = chunkMarkdown(params.text, this.settings.chunking);

  // 2. Vectorize (reuse existing embedChunksInBatches - includes caching and retry)
  const embeddings = this.batch.enabled
    ? await this.embedChunksWithBatch(chunks, { path: params.filepath }, 'knowledge')
    : await this.embedChunksInBatches(chunks);

  // 3. Insert into files table (source='knowledge')
  this.db.prepare(`
    INSERT OR REPLACE INTO files (path, source, hash, mtime, size)
    VALUES (?, 'knowledge', ?, ?, ?)
  `).run(params.filepath, params.metadata.hash, Date.now(), params.metadata.size);

  // 4. Insert chunks and vector indexes
  for (let i = 0; i < chunks.length; i++) {
    const id = hashText(`knowledge:${params.filepath}:${chunks[i].startLine}:${chunks[i].endLine}:${chunks[i].hash}:${this.provider.model}`);

    // Insert into chunks table
    this.db.prepare(`
      INSERT INTO chunks (id, path, source, start_line, end_line, hash, model, text, embedding, updated_at)
      VALUES (?, ?, 'knowledge', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET hash=excluded.hash, text=excluded.text, embedding=excluded.embedding, updated_at=excluded.updated_at
    `).run(id, params.filepath, chunks[i].startLine, chunks[i].endLine, chunks[i].hash,
           this.provider.model, chunks[i].text, JSON.stringify(embeddings[i]), Date.now());

    // Insert into vector table (if sqlite-vec enabled)
    if (await this.ensureVectorReady(embeddings[i].length)) {
      this.db.prepare(`INSERT INTO chunks_vec (id, embedding) VALUES (?, ?)`).run(
        id,
        vectorToBlob(embeddings[i])
      );
    }

    // Insert into FTS table (if enabled)
    if (this.fts.enabled && this.fts.available) {
      this.db.prepare(`
        INSERT INTO chunks_fts (text, id, path, source, model, start_line, end_line)
        VALUES (?, ?, ?, 'knowledge', ?, ?, ?)
      `).run(chunks[i].text, id, params.filepath, this.provider.model,
             chunks[i].startLine, chunks[i].endLine);
    }
  }
}
```

**Key Points**:

1. ✅ Fully reuses existing `embedChunksInBatches()` - includes caching, batching, retry logic
2. ✅ Automatically uses embedding cache (dedup based on text hash)
3. ✅ Supports OpenAI/Gemini Batch API (if configured)
4. ✅ Automatically inserts into chunks_vec (sqlite-vec) and chunks_fts (BM25) indexes
5. ✅ Fully isolated from existing memory and sessions sources (via source column)

---

## Database Schema Design

### Simplified Schema (Permissions Table Removed)

Add to existing `memory/<agentId>.sqlite`:

```sql
-- Document metadata table
CREATE TABLE IF NOT EXISTS kb_documents (
  id TEXT PRIMARY KEY,              -- UUID v4
  filename TEXT NOT NULL,           -- Original filename
  filepath TEXT NOT NULL,           -- Storage path: knowledge/<id>.<ext>
  mimetype TEXT NOT NULL,           -- MIME type
  size INTEGER NOT NULL,            -- File size in bytes
  hash TEXT NOT NULL,               -- SHA-256 content hash
  source_type TEXT NOT NULL,        -- 'web_api' | 'chat_attachment'
  source_metadata TEXT,             -- JSON: { channel, chatId, userId, ... }
  uploaded_at INTEGER NOT NULL,     -- Unix timestamp (ms)
  indexed_at INTEGER,               -- Index completion time
  owner_agent_id TEXT NOT NULL,     -- Owner agent
  description TEXT,                 -- User-provided description
  UNIQUE(hash, owner_agent_id)      -- Same agent cannot upload duplicate document
);

-- Document tags (many-to-many)
CREATE TABLE IF NOT EXISTS kb_tags (
  document_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (document_id, tag),
  FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag);
CREATE INDEX IF NOT EXISTS idx_kb_documents_agent ON kb_documents(owner_agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_uploaded ON kb_documents(uploaded_at DESC);
```

**Relationship with Existing `files`/`chunks` Tables**:

- `files.source = 'knowledge'` and `files.path = kb_documents.filepath`
- `chunks.source = 'knowledge'` links to `files`
- `kb_documents` provides additional metadata (tags, description, upload source, etc.)

---

## Test Specifications and Code Style

### Test File Structure (Project Style)

Reference `src/memory/internal.test.ts` and `src/agents/memory-search.test.ts`:

```typescript
// src/memory/knowledge-processor.test.ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PdfProcessor,
  DocxProcessor,
  TextProcessor,
  HtmlProcessor,
} from "./knowledge-processor.js";

describe("PdfProcessor", () => {
  let processor: PdfProcessor;

  beforeEach(() => {
    processor = new PdfProcessor();
  });

  it("extracts text from PDF buffer", async () => {
    const pdfBuffer = await fs.readFile(path.join(__dirname, "../__fixtures__/sample.pdf"));
    const text = await processor.extract(pdfBuffer, {});
    expect(text).toContain("expected content");
    expect(text.length).toBeGreaterThan(0);
  });

  it("respects maxPages option", async () => {
    const pdfBuffer = await fs.readFile(path.join(__dirname, "../__fixtures__/multi-page.pdf"));
    const text = await processor.extract(pdfBuffer, { maxPages: 2 });
    // Verify only first 2 pages processed
    expect(text.split("\n").length).toBeLessThan(200); // Assume ~100 lines per page
  });

  it("handles malformed PDF gracefully", async () => {
    const invalidBuffer = Buffer.from("not a pdf");
    await expect(processor.extract(invalidBuffer, {})).rejects.toThrow();
  });
});

describe("ProcessorRegistry", () => {
  it("returns correct processor for mimetype", () => {
    const registry = new ProcessorRegistry();
    expect(registry.getProcessor("application/pdf")).toBeInstanceOf(PdfProcessor);
    expect(registry.getProcessor("text/plain")).toBeInstanceOf(TextProcessor);
  });

  it("returns null for unsupported mimetype", () => {
    const registry = new ProcessorRegistry();
    expect(registry.getProcessor("application/octet-stream")).toBeNull();
  });
});
```

### Code Style Guidelines

Reference existing code:

1. **Import Order** (ref `memory-tool.ts:1-8`):

```typescript
// 1. Node.js built-in modules
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";

// 2. Third-party libraries
import { Type } from "@sinclair/typebox";

// 3. Project internal modules (by hierarchy)
import type { MoltbotConfig } from "../../config/config.js";
import { getMemorySearchManager } from "../../memory/index.js";
import type { AnyAgentTool } from "./common.js";
```

2. **Tool Definition Pattern** (ref `memory-tool.ts:22-69`):

```typescript
export function createKnowledgeTool(options: {
  config?: MoltbotConfig;
  agentSessionKey?: string;
}): AnyAgentTool | null {
  const cfg = options.config;
  if (!cfg) return null;

  const agentId = resolveSessionAgentId({
    sessionKey: options.agentSessionKey,
    config: cfg,
  });

  const knowledgeConfig = resolveKnowledgeConfig(cfg, agentId);
  if (!knowledgeConfig?.enabled) return null;

  return {
    label: "Knowledge Upload", // Human-readable label
    name: "knowledge_upload", // Tool name (snake_case)
    description: "...", // Detailed description
    parameters: Type.Object({
      // TypeBox schema
      filename: Type.String({ description: "..." }),
      content: Type.String({ description: "..." }),
    }),
    execute: async (_toolCallId, params, { log }) => {
      const filename = readStringParam(params, "filename", { required: true });

      try {
        // Implementation logic
        return jsonResult({ success: true, data });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return jsonResult({ error: message });
      }
    },
  };
}
```

3. **Error Handling** (ref `memory-tool.ts:64-66`):

```typescript
try {
  const results = await manager.search(query, opts);
  return jsonResult({ results, provider: status.provider });
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  return jsonResult({ results: [], disabled: true, error: message });
}
```

4. **Type Safety** (Strict TypeScript):

```typescript
// Use explicit type annotations
const chunks: MemoryChunk[] = chunkMarkdown(text, settings.chunking);
const embeddings: number[][] = await this.embedChunksInBatches(chunks);

// Avoid any, use unknown + type guards
catch (err) {
  const message = err instanceof Error ? err.message : String(err);
}
```

5. **Comment Style** (Concise, explain "why"):

```typescript
// ✅ Good comment
// Reuse existing PDF extraction from input-files.ts
const text = await extractPdfContent(buffer);

// ❌ Bad comment
// Extract text from PDF
const text = await extractPdfContent(buffer);
```

---

## Implementation Checklist (With Test Requirements)

### Phase 1: Database and Configuration

**Files**:

1. `src/memory/knowledge-schema.ts` - Schema definition
2. `src/memory/knowledge-schema.test.ts` - Schema tests
3. `src/config/types.tools.ts` - Type extensions
4. `src/config/zod-schema.agent-runtime.ts` - Zod schema
5. `src/agents/knowledge-config.ts` - Config resolution
6. `src/agents/knowledge-config.test.ts` - Config tests

**Test Coverage**:

- Schema creation and migration
- Index existence verification
- Config parsing and merging logic
- Default value validation

---

### Phase 2: Document Processing

**Files**:

1. `src/memory/knowledge-processor.ts` - Processor implementation
2. `src/memory/knowledge-processor.test.ts` - Processor tests
3. `src/memory/knowledge-storage.ts` - Storage management
4. `src/memory/knowledge-storage.test.ts` - Storage tests

**Test Coverage**:

- PDF text extraction (normal docs, multi-page, image PDFs)
- DOCX to Markdown (headings, lists, bold/italic)
- TXT/Markdown encoding detection
- HTML text extraction (tag removal, structure preservation)
- File storage and deletion
- Hash calculation and deduplication
- Error handling (format errors, corrupted files)

**Fixtures Preparation**:

```
src/__fixtures__/
├── sample.pdf          # 2-page normal PDF
├── multi-page.pdf      # 10-page PDF
├── image-only.pdf      # Image-only PDF
├── sample.docx         # Formatted DOCX
├── empty.docx          # Empty DOCX
├── sample.html         # HTML document
└── sample.txt          # UTF-8 text
```

---

### Phase 3: Manager Extension

**Files**:

1. `src/memory/manager.ts` - Add `ingestKnowledgeDocument()`, `deleteKnowledgeDocument()`
2. `src/memory/manager-knowledge.test.ts` - Knowledge base indexing tests

**Test Coverage**:

- Document ingestion → chunking → vectorization → storage E2E
- Source filtering (search returns only knowledge results)
- Document deletion (file + index + vector)
- Isolation verification from existing memory/sessions

---

### Phase 4: Agent Tools

**Files**:

1. `src/agents/tools/knowledge-tool.ts` - 4 tools
2. `src/agents/tools/knowledge-tool.test.ts` - Tool tests
3. `src/agents/moltbot-tools.ts` - Tool registration

**Test Coverage**:

- `knowledge_upload`: Success upload, size limits, format validation, tag storage
- `knowledge_search`: Search results, tag filtering, metadata enrichment
- `knowledge_list`: List queries, pagination, tag filtering
- `knowledge_delete`: Permission validation, cascade deletion

---

### Phase 5: HTTP API

**Files**:

1. `src/gateway/server/knowledge-http.ts` - HTTP handler
2. `src/gateway/server/knowledge-http.test.ts` - HTTP tests
3. `src/gateway/server-http.ts` - Route registration

**Test Coverage**:

- Multipart upload parsing
- File size limits
- Authentication verification
- Async indexing
- Error response formats

---

### Phase 6: Channel Integration

**Files**:

1. `src/telegram/bot.ts` - Telegram attachment interception
2. `src/web/inbound/index.ts` - WhatsApp attachment interception
3. `src/discord/monitor/message-handler.ts` - Discord attachment interception
4. `src/memory/knowledge-attachment.test.ts` - Attachment integration tests

**Test Coverage**:

- Attachment detection and download
- Format validation and filtering
- Config switch verification
- Confirmation message sending

---

## E2E Test Scenarios

```typescript
// src/memory/knowledge.e2e.test.ts
describe("Knowledge Base E2E", () => {
  it("full workflow: upload → index → search → delete", async () => {
    // 1. Upload document
    const uploadResult = await knowledgeUpload.execute("id1", {
      filename: "test.txt",
      content: Buffer.from("Important information about project X").toString("base64"),
      mimetype: "text/plain",
      tags: ["project-x", "docs"],
    });

    expect(uploadResult.documentId).toBeDefined();
    const docId = uploadResult.documentId;

    // 2. Wait for indexing
    await waitForIndexing(docId);

    // 3. Search document
    const searchResult = await knowledgeSearch.execute("id2", {
      query: "project X information",
      maxResults: 10,
    });

    expect(searchResult.results).toHaveLength(1);
    expect(searchResult.results[0].document.filename).toBe("test.txt");
    expect(searchResult.results[0].document.tags).toContain("project-x");

    // 4. List verification
    const listResult = await knowledgeList.execute("id3", {
      tags: ["project-x"],
    });

    expect(listResult.documents).toHaveLength(1);
    expect(listResult.documents[0].id).toBe(docId);

    // 5. Delete document
    const deleteResult = await knowledgeDelete.execute("id4", {
      documentId: docId,
    });

    expect(deleteResult.deleted).toBe(true);

    // 6. Verify deletion
    const searchAfterDelete = await knowledgeSearch.execute("id5", {
      query: "project X information",
    });

    expect(searchAfterDelete.results).toHaveLength(0);
  });

  it("handles duplicate upload (same hash)", async () => {
    const content = "Duplicate content";

    const first = await knowledgeUpload.execute("id1", {
      filename: "doc1.txt",
      content: Buffer.from(content).toString("base64"),
      mimetype: "text/plain",
    });

    const second = await knowledgeUpload.execute("id2", {
      filename: "doc2.txt", // Different filename
      content: Buffer.from(content).toString("base64"), // Same content
      mimetype: "text/plain",
    });

    // Should reject duplicate upload
    expect(second).toHaveProperty("error");
    expect(second.error).toContain("duplicate");
  });
});
```

---

## Code Quality Checklist

### Pre-Commit Checks

```bash
# 1. Lint
pnpm lint

# 2. Type check
pnpm build

# 3. Tests
pnpm test src/memory/knowledge-processor.test.ts
pnpm test src/agents/tools/knowledge-tool.test.ts
pnpm test src/memory/knowledge.e2e.test.ts

# 4. Coverage
pnpm test:coverage
# Ensure new code reaches 70% coverage

# 5. Manual testing
pnpm moltbot gateway --port 18789
# Run manual test checklist (see Phase 6)
```

### PR Checklist

- [ ] All tests pass (`pnpm test`)
- [ ] Coverage ≥ 70% (`pnpm test:coverage`)
- [ ] No lint errors (`pnpm lint`)
- [ ] Type check passes (`pnpm build`)
- [ ] Test fixtures added (if needed)
- [ ] CHANGELOG.md updated
- [ ] Manual E2E flow verified
- [ ] Documentation updated (if needed)

---

## Critical Files Summary

### New Files (~15 files)

| File                                        | Estimated Lines | Test Coverage |
| ------------------------------------------- | --------------- | ------------- |
| `src/memory/knowledge-schema.ts`            | 80              | ✅            |
| `src/memory/knowledge-processor.ts`         | 250             | ✅            |
| `src/memory/knowledge-storage.ts`           | 150             | ✅            |
| `src/agents/knowledge-config.ts`            | 120             | ✅            |
| `src/agents/tools/knowledge-tool.ts`        | 600             | ✅            |
| `src/gateway/server/knowledge-http.ts`      | 400             | ✅            |
| **Test Files**                              |                 |               |
| `src/memory/knowledge-schema.test.ts`       | 100             | -             |
| `src/memory/knowledge-processor.test.ts`    | 300             | -             |
| `src/memory/knowledge-storage.test.ts`      | 200             | -             |
| `src/agents/knowledge-config.test.ts`       | 150             | -             |
| `src/agents/tools/knowledge-tool.test.ts`   | 400             | -             |
| `src/gateway/server/knowledge-http.test.ts` | 250             | -             |
| `src/memory/manager-knowledge.test.ts`      | 200             | -             |
| `src/memory/knowledge.e2e.test.ts`          | 300             | -             |
| **Total**                                   | **~3500 lines** |               |

### Modified Files (8 files)

1. `src/memory/manager.ts` (+150 lines)
2. `src/config/types.tools.ts` (+50 lines)
3. `src/config/zod-schema.agent-runtime.ts` (+40 lines)
4. `src/agents/moltbot-tools.ts` (+15 lines)
5. `src/gateway/server-http.ts` (+10 lines)
6. `src/telegram/bot.ts` (+60 lines)
7. `src/web/inbound/index.ts` (+50 lines)
8. `src/discord/monitor/message-handler.ts` (+50 lines)

---

## Summary

This implementation plan:

✅ **Project Style Compliant**: References existing code patterns (memory-tool.ts, internal.test.ts)
✅ **Complete Test Coverage**: Unit tests + Integration tests + E2E tests
✅ **Vectorization Transparency**: Detailed call chain and cache reuse explanation
✅ **Simplified Permissions**: Removed complex permission table, only agent isolation
✅ **Production Ready**: Error handling, retry logic, quota limits

**Estimated Effort**: 11-13 days (including complete testing)
**PR Strategy**: 3 incremental PRs, each independently testable
