import type { DatabaseSync } from "node:sqlite";

/**
 * Ensures knowledge base schema tables exist in the memory database.
 * This schema stores document metadata, tags, and relationships.
 * Vector embeddings are stored in the existing chunks_vec table via source='knowledge'.
 */
export function ensureKnowledgeSchema(db: DatabaseSync): void {
  // Document metadata table
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_documents (
      id TEXT PRIMARY KEY,
      kb_id TEXT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      hash TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_metadata TEXT,
      uploaded_at INTEGER NOT NULL,
      indexed_at INTEGER,
      owner_agent_id TEXT NOT NULL,
      description TEXT,
      UNIQUE(hash, owner_agent_id)
    )
  `);

  // Document tags (many-to-many relationship)
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_tags (
      document_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      PRIMARY KEY (document_id, tag),
      FOREIGN KEY (document_id) REFERENCES kb_documents(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_settings (
      owner_agent_id TEXT PRIMARY KEY,
      vector_config TEXT,
      graph_config TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_bases (
      id TEXT PRIMARY KEY,
      owner_agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      visibility TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(owner_agent_id, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_base_settings (
      kb_id TEXT PRIMARY KEY,
      owner_agent_id TEXT NOT NULL,
      vectorization_config TEXT NOT NULL,
      chunk_config TEXT NOT NULL,
      retrieval_config TEXT NOT NULL,
      index_config TEXT NOT NULL,
      graph_config TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (kb_id) REFERENCES kb_bases(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_tag_defs (
      id TEXT PRIMARY KEY,
      owner_agent_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(owner_agent_id, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_base_tags (
      kb_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      owner_agent_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (kb_id, tag_id),
      FOREIGN KEY (kb_id) REFERENCES kb_bases(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES kb_tag_defs(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_graph_runs (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      status TEXT NOT NULL,
      triples_path TEXT,
      extractor TEXT,
      model TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_graph_triples (
      id TEXT PRIMARY KEY,
      kb_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      h TEXT NOT NULL,
      r TEXT NOT NULL,
      t TEXT NOT NULL,
      props_json TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  try {
    db.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_graph_fts USING fts5(\n` +
        `  content,\n` +
        `  triple_id UNINDEXED,\n` +
        `  kb_id UNINDEXED,\n` +
        `  document_id UNINDEXED,\n` +
        `  h UNINDEXED,\n` +
        `  r UNINDEXED,\n` +
        `  t UNINDEXED\n` +
        `);`,
    );
  } catch {
    // FTS5 may be unavailable; fallback to non-FTS search.
  }

  // Indexes for efficient queries
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_tags_tag ON kb_tags(tag)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_documents_agent ON kb_documents(owner_agent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_documents_kb ON kb_documents(kb_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_documents_uploaded ON kb_documents(uploaded_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_settings_agent ON kb_settings(owner_agent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_bases_agent ON kb_bases(owner_agent_id)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_kb_base_settings_agent ON kb_base_settings(owner_agent_id)`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_tag_defs_agent ON kb_tag_defs(owner_agent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_base_tags_agent ON kb_base_tags(owner_agent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_base_tags_tag ON kb_base_tags(tag_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_graph_runs_kb ON knowledge_graph_runs(kb_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_graph_runs_doc ON knowledge_graph_runs(document_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_graph_triples_kb ON knowledge_graph_triples(kb_id)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_kb_graph_triples_doc ON knowledge_graph_triples(document_id)`,
  );
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_graph_triples_h ON knowledge_graph_triples(h)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kb_graph_triples_t ON knowledge_graph_triples(t)`);
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_kb_graph_triples_created ON knowledge_graph_triples(created_at)`,
  );

  ensureColumn(db, "kb_documents", "kb_id", "TEXT");
  ensureColumn(
    db,
    "kb_base_settings",
    "vectorization_config",
    `TEXT NOT NULL DEFAULT '{"enabled":true}'`,
  );
}

/**
 * Document metadata stored in kb_documents table
 */
export type KnowledgeDocument = {
  id: string;
  kb_id?: string | null;
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
  hash: string;
  source_type: "web_api" | "chat_attachment";
  source_metadata?: string; // JSON string
  uploaded_at: number;
  indexed_at?: number;
  owner_agent_id: string;
  description?: string;
};

/**
 * Document tag association
 */
export type KnowledgeTag = {
  document_id: string;
  tag: string;
};

export type KnowledgeBaseSettings = {
  owner_agent_id: string;
  vector_config?: string | null;
  graph_config?: string | null;
  updated_at: number;
};

export type KnowledgeBaseEntry = {
  id: string;
  owner_agent_id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  visibility: "private" | "team" | "public";
  created_at: number;
  updated_at: number;
};

export type KnowledgeBaseTagDefinition = {
  id: string;
  owner_agent_id: string;
  name: string;
  color?: string | null;
  created_at: number;
  updated_at: number;
};

export type KnowledgeBaseTagBinding = {
  kb_id: string;
  tag_id: string;
  owner_agent_id: string;
  created_at: number;
};

export type KnowledgeChunkConfig = {
  enabled: boolean;
  size: number;
  overlap: number;
  separator: "auto" | "paragraph" | "sentence";
};

export type KnowledgeRetrievalConfig = {
  mode: "semantic" | "keyword" | "hybrid";
  topK: number;
  minScore: number;
  hybridAlpha: number;
};

export type KnowledgeIndexConfig = {
  mode: "high_quality" | "balanced";
};

export type KnowledgeBaseGraphConfig = {
  enabled: boolean;
};

export type KnowledgeBaseRuntimeSettings = {
  vectorization: {
    enabled: boolean;
  };
  chunk: KnowledgeChunkConfig;
  retrieval: KnowledgeRetrievalConfig;
  index: KnowledgeIndexConfig;
  graph: KnowledgeBaseGraphConfig;
};

export type KnowledgeBaseSettingsEntry = {
  kb_id: string;
  owner_agent_id: string;
  vectorization_config: string;
  chunk_config: string;
  retrieval_config: string;
  index_config: string;
  graph_config: string;
  created_at: number;
  updated_at: number;
};

function ensureColumn(
  db: DatabaseSync,
  table: "kb_documents" | "kb_base_settings",
  column: string,
  definition: string,
): void {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some((row) => row.name === column)) {
    return;
  }
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export type KnowledgeGraphRun = {
  id: string;
  kb_id: string;
  document_id: string;
  status: "pending" | "running" | "success" | "failed";
  triples_path?: string | null;
  extractor?: string | null;
  model?: string | null;
  error?: string | null;
  created_at: number;
  updated_at: number;
};

export type KnowledgeGraphTriple = {
  id: string;
  kb_id: string;
  document_id: string;
  h: string;
  r: string;
  t: string;
  props_json?: string | null;
  created_at: number;
};
