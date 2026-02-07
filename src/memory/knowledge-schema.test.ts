import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureKnowledgeSchema } from "./knowledge-schema.js";

describe("ensureKnowledgeSchema", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseSync;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "kb-schema-test-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = new DatabaseSync(dbPath);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates kb_documents table", () => {
    ensureKnowledgeSchema(db);

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='kb_documents'`)
      .all();

    expect(tables).toHaveLength(1);
  });

  it("creates kb_tags table", () => {
    ensureKnowledgeSchema(db);

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='kb_tags'`)
      .all();

    expect(tables).toHaveLength(1);
  });

  it("creates required indexes", () => {
    ensureKnowledgeSchema(db);

    const indexes = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_kb_%'`)
      .all() as Array<{ name: string }>;

    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain("idx_kb_tags_tag");
    expect(indexNames).toContain("idx_kb_documents_agent");
    expect(indexNames).toContain("idx_kb_documents_uploaded");
  });

  it("allows inserting document metadata", () => {
    ensureKnowledgeSchema(db);

    const now = Date.now();
    db.prepare(
      `INSERT INTO kb_documents
      (id, filename, filepath, mimetype, size, hash, source_type, uploaded_at, owner_agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "doc-123",
      "test.pdf",
      "knowledge/doc-123.pdf",
      "application/pdf",
      1024,
      "hash123",
      "web_api",
      now,
      "main",
    );

    const docs = db.prepare(`SELECT * FROM kb_documents WHERE id = ?`).all("doc-123");
    expect(docs).toHaveLength(1);
  });

  it("enforces unique constraint on hash + owner_agent_id", () => {
    ensureKnowledgeSchema(db);

    const now = Date.now();
    const insertDoc = db.prepare(
      `INSERT INTO kb_documents
      (id, filename, filepath, mimetype, size, hash, source_type, uploaded_at, owner_agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    // First insert should succeed
    insertDoc.run(
      "doc-1",
      "test1.pdf",
      "knowledge/doc-1.pdf",
      "application/pdf",
      1024,
      "same-hash",
      "web_api",
      now,
      "main",
    );

    // Second insert with same hash + agent should fail
    expect(() => {
      insertDoc.run(
        "doc-2",
        "test2.pdf",
        "knowledge/doc-2.pdf",
        "application/pdf",
        2048,
        "same-hash",
        "web_api",
        now,
        "main",
      );
    }).toThrow();

    // Insert with same hash but different agent should succeed
    insertDoc.run(
      "doc-3",
      "test3.pdf",
      "knowledge/doc-3.pdf",
      "application/pdf",
      1024,
      "same-hash",
      "web_api",
      now,
      "other-agent",
    );

    const docs = db.prepare(`SELECT * FROM kb_documents`).all();
    expect(docs).toHaveLength(2);
  });

  it("cascades tag deletions when document is deleted", () => {
    ensureKnowledgeSchema(db);

    const now = Date.now();
    db.prepare(
      `INSERT INTO kb_documents
      (id, filename, filepath, mimetype, size, hash, source_type, uploaded_at, owner_agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "doc-123",
      "test.pdf",
      "knowledge/doc-123.pdf",
      "application/pdf",
      1024,
      "hash123",
      "web_api",
      now,
      "main",
    );

    db.prepare(`INSERT INTO kb_tags (document_id, tag) VALUES (?, ?)`).run("doc-123", "test");
    db.prepare(`INSERT INTO kb_tags (document_id, tag) VALUES (?, ?)`).run("doc-123", "sample");

    const tagsBeforeDelete = db
      .prepare(`SELECT * FROM kb_tags WHERE document_id = ?`)
      .all("doc-123");
    expect(tagsBeforeDelete).toHaveLength(2);

    // Delete document
    db.prepare(`DELETE FROM kb_documents WHERE id = ?`).run("doc-123");

    // Tags should be cascade deleted
    const tagsAfterDelete = db
      .prepare(`SELECT * FROM kb_tags WHERE document_id = ?`)
      .all("doc-123");
    expect(tagsAfterDelete).toHaveLength(0);
  });

  it("is idempotent (can be called multiple times)", () => {
    ensureKnowledgeSchema(db);
    ensureKnowledgeSchema(db); // Second call should not fail

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'kb_%'`)
      .all();

    expect(tables).toHaveLength(2); // kb_documents and kb_tags
  });
});
