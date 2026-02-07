import type { MemorySearchOverrides } from "../agents/memory-search.js";
import type { OpenClawConfig } from "../config/config.js";
import type { MemoryIndexManager } from "./manager.js";
import { resolveAgentDir } from "../agents/agent-scope.js";
import { resolveKnowledgeConfig } from "../agents/knowledge-config.js";
import { requireNodeSqlite } from "./sqlite.js";

export type MemorySearchManagerResult = {
  manager: MemoryIndexManager | null;
  error?: string;
};

export async function getMemorySearchManager(params: {
  cfg: OpenClawConfig;
  agentId: string;
}): Promise<MemorySearchManagerResult> {
  try {
    const { MemoryIndexManager } = await import("./manager.js");
    const overrides = loadKnowledgeVectorOverrides(params.cfg, params.agentId);
    const manager = await MemoryIndexManager.get({ ...params, overrides });
    return { manager };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { manager: null, error: message };
  }
}

function loadKnowledgeVectorOverrides(
  cfg: OpenClawConfig,
  agentId: string,
): MemorySearchOverrides | undefined {
  const knowledgeConfig = resolveKnowledgeConfig(cfg, agentId);
  if (!knowledgeConfig?.search.includeInMemorySearch) {
    return undefined;
  }
  const { DatabaseSync } = requireNodeSqlite();
  const agentDir = resolveAgentDir(cfg, agentId);
  const db = new DatabaseSync(`${agentDir}/memory.db`);
  try {
    const row = db
      .prepare(`SELECT vector_config FROM kb_settings WHERE owner_agent_id = ?`)
      .get(agentId) as { vector_config?: string | null } | undefined;
    if (!row?.vector_config) {
      return undefined;
    }
    const parsed = JSON.parse(row.vector_config) as MemorySearchOverrides & { enabled?: boolean };
    if (parsed.enabled === false) {
      return undefined;
    }
    const overrides: MemorySearchOverrides = {};
    if (parsed.provider) {
      overrides.provider = parsed.provider;
    }
    if (parsed.model) {
      overrides.model = parsed.model;
    }
    return Object.keys(overrides).length ? overrides : undefined;
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}
