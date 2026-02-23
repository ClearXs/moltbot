import { useConnectionStore } from "@/stores/connectionStore";

const GATEWAY_HTTP_URL = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || "";
const AGENT_ID_HEADER = process.env.NEXT_PUBLIC_AGENT_ID || "";

const isAbsoluteUrl = (value: string) => /^https?:\/\//.test(value);

const resolveGatewayBaseUrl = () => {
  if (isAbsoluteUrl(GATEWAY_HTTP_URL)) return GATEWAY_HTTP_URL;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${GATEWAY_HTTP_URL}`;
  }
  return `http://localhost${GATEWAY_HTTP_URL}`;
};

const buildGatewayUrl = (path: string) => {
  const base = resolveGatewayBaseUrl();
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase);
};

export type KnowledgeDocument = {
  id: string;
  kbId?: string;
  filename: string;
  mimetype: string;
  size: number;
  uploadedAt: string;
  indexed?: boolean;
  tags?: string[];
  description?: string;
  sourceType?: string;
};

export type KnowledgeListResponse = {
  total: number;
  returned: number;
  offset: number;
  documents: KnowledgeDocument[];
};

export type KnowledgeDetail = {
  id: string;
  kbId?: string;
  filename: string;
  filepath?: string;
  mimetype: string;
  size: number;
  hash?: string;
  sourceType?: string;
  sourceMetadata?: unknown;
  uploadedAt?: string;
  indexedAt?: string;
  description?: string;
  tags?: string[];
};

export type KnowledgeChunk = {
  id: string;
  index: number;
  text: string;
  tokens?: number;
  sourcePage?: number | null;
  status?: string;
  startLine?: number;
  endLine?: number;
};

export type KnowledgeChunksResponse = {
  total: number;
  returned: number;
  offset: number;
  chunks: KnowledgeChunk[];
};

export type KnowledgeChunkDetailResponse = {
  chunk: KnowledgeChunk & { documentId?: string };
};

export type KnowledgeSettingsResponse = {
  vectorization: {
    enabled: boolean;
    provider: string;
    model: string;
  };
  graph: {
    enabled: boolean;
    extractor: "llm";
    provider: string;
    model: string;
    minTriples: number;
    maxTriples: number;
    triplesPerKTokens: number;
    maxDepth: number;
  };
  updatedAt: number;
};

export type KnowledgeBase = {
  kbId: string;
  name: string;
  description?: string;
  icon?: string;
  visibility?: "private" | "team" | "public";
  tags?: KnowledgeBaseTag[];
  settings?: KnowledgeBaseRuntimeSettings;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalTriples?: number;
    totalEntities?: number;
  };
};

export type KnowledgeBaseTag = {
  tagId: string;
  name: string;
  color: string | null;
};

export type KnowledgeBaseTagInput = {
  name: string;
  color?: string;
};

export type KnowledgeBaseRuntimeSettings = {
  vectorization: {
    enabled: boolean;
  };
  chunk: {
    enabled: boolean;
    size: number;
    overlap: number;
    separator: "auto" | "paragraph" | "sentence";
  };
  retrieval: {
    mode: "semantic" | "keyword" | "hybrid";
    topK: number;
    minScore: number;
    hybridAlpha: number;
  };
  index: {
    mode: "high_quality" | "balanced";
  };
  graph: {
    enabled: boolean;
  };
};

export type KnowledgeBaseListResponse = {
  total: number;
  returned: number;
  offset: number;
  kbs: KnowledgeBase[];
};

export type KnowledgeBaseCreateParams = {
  name: string;
  description?: string;
  icon?: string;
  visibility?: "private" | "team" | "public";
  tags?: KnowledgeBaseTagInput[];
  settings?: Partial<KnowledgeBaseRuntimeSettings>;
};

export type KnowledgeBaseUpdateParams = {
  kbId: string;
  name?: string;
  description?: string;
  icon?: string;
  visibility?: "private" | "team" | "public";
  tags?: KnowledgeBaseTagInput[];
};

export type KnowledgeSearchResult = {
  documentId: string;
  filename: string;
  chunkId?: string;
  snippet?: string;
  score?: number;
  lines?: string;
};

export type KnowledgeSearchResponse = {
  query: string;
  resultsCount: number;
  results: KnowledgeSearchResult[];
};

export const buildHeaders = () => {
  const token = useConnectionStore.getState().gatewayToken;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (AGENT_ID_HEADER) headers["x-openclaw-agent-id"] = AGENT_ID_HEADER;
  return headers;
};

export const getGatewayBaseUrl = () => resolveGatewayBaseUrl();

export async function createKnowledgeBase(
  params: KnowledgeBaseCreateParams,
): Promise<KnowledgeBase> {
  const response = await fetch(`${resolveGatewayBaseUrl()}/api/knowledge/base`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库创建失败");
  }
  return data as KnowledgeBase;
}

export async function listKnowledgeBases(params: {
  limit?: number;
  offset?: number;
  search?: string;
  visibility?: "private" | "team" | "public";
  tags?: string[];
}): Promise<KnowledgeBaseListResponse> {
  const url = buildGatewayUrl("/api/knowledge/base/list");
  if (typeof params.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") url.searchParams.set("offset", String(params.offset));
  if (params.search) url.searchParams.set("search", params.search);
  if (params.visibility) url.searchParams.set("visibility", params.visibility);
  if (params.tags && params.tags.length > 0) {
    params.tags.forEach((tag) => url.searchParams.append("tags", tag));
  }
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库列表加载失败");
  }
  return data as KnowledgeBaseListResponse;
}

export async function getKnowledgeBase(kbId: string): Promise<KnowledgeBase> {
  const url = buildGatewayUrl("/api/knowledge/base/get");
  url.searchParams.set("kbId", kbId);
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库详情加载失败");
  }
  return data as KnowledgeBase;
}

export async function updateKnowledgeBase(
  params: KnowledgeBaseUpdateParams,
): Promise<KnowledgeBase> {
  const response = await fetch(`${resolveGatewayBaseUrl()}/api/knowledge/base`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库更新失败");
  }
  return data as KnowledgeBase;
}

export async function deleteKnowledgeBase(kbId: string): Promise<void> {
  const response = await fetch(`${resolveGatewayBaseUrl()}/api/knowledge/base/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify({ kbId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库删除失败");
  }
}

export async function updateKnowledge(params: {
  kbId: string;
  documentId: string;
  file: File;
  description?: string;
  tags?: string[];
}): Promise<{
  documentId: string;
  filename: string;
  size: number;
  indexed?: boolean;
  updatedAt?: string;
}> {
  const form = new FormData();
  form.append("kbId", params.kbId);
  form.append("documentId", params.documentId);
  form.append("file", params.file);
  if (params.description) form.append("description", params.description);
  if (params.tags && params.tags.length > 0) form.append("tags", params.tags.join(","));
  const response = await fetch(`${resolveGatewayBaseUrl()}/api/knowledge/update`, {
    method: "POST",
    headers: buildHeaders(),
    body: form,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "文档更新失败");
  }
  return data;
}

export async function updateKnowledgeMetadata(params: {
  kbId: string;
  documentId: string;
  filename?: string;
  description?: string;
  tags?: string[];
}): Promise<KnowledgeDetail> {
  const response = await fetch(`${resolveGatewayBaseUrl()}/api/knowledge/metadata`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "文档元信息更新失败");
  }
  return data as KnowledgeDetail;
}

export async function listKnowledge(params: {
  kbId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<KnowledgeListResponse> {
  const url = buildGatewayUrl("/api/knowledge/list");
  if (params.kbId) url.searchParams.set("kbId", params.kbId);
  if (params.tags && params.tags.length > 0) {
    params.tags.forEach((tag) => url.searchParams.append("tags", tag));
  }
  if (typeof params.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") url.searchParams.set("offset", String(params.offset));

  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库列表加载失败");
  }
  return data as KnowledgeListResponse;
}

export async function getKnowledge(documentId: string, kbId?: string): Promise<KnowledgeDetail> {
  const url = buildGatewayUrl("/api/knowledge/get");
  url.searchParams.set("documentId", documentId);
  if (kbId) url.searchParams.set("kbId", kbId);
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库详情加载失败");
  }
  return data as KnowledgeDetail;
}

export async function uploadKnowledge(params: {
  kbId: string;
  file: File;
  description?: string;
  tags?: string[];
}): Promise<{ documentId: string; filename: string; size: number; indexed?: boolean }> {
  const form = new FormData();
  form.append("kbId", params.kbId);
  form.append("file", params.file);
  if (params.description) form.append("description", params.description);
  if (params.tags && params.tags.length > 0) form.append("tags", params.tags.join(","));

  const response = await fetch(`${resolveGatewayBaseUrl()}/api/knowledge/upload`, {
    method: "POST",
    headers: buildHeaders(),
    body: form,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库上传失败");
  }
  return data;
}

export async function uploadKnowledgeWithProgress(
  params: {
    kbId: string;
    file: File;
    description?: string;
    tags?: string[];
  },
  onProgress?: (progress: number) => void,
): Promise<{ documentId: string; filename: string; size: number; indexed?: boolean }> {
  const form = new FormData();
  form.append("kbId", params.kbId);
  form.append("file", params.file);
  if (params.description) form.append("description", params.description);
  if (params.tags && params.tags.length > 0) form.append("tags", params.tags.join(","));

  const headers = buildHeaders();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${resolveGatewayBaseUrl()}/api/knowledge/upload`);

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };

    xhr.onerror = () => {
      reject(new Error("知识库上传失败"));
    };

    xhr.onload = () => {
      let data: unknown;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = {};
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        const message =
          data && typeof data === "object" && "message" in data
            ? String((data as { message?: string }).message || "知识库上传失败")
            : "知识库上传失败";
        reject(new Error(message));
        return;
      }

      onProgress?.(100);
      resolve(data as { documentId: string; filename: string; size: number; indexed?: boolean });
    };

    xhr.send(form);
  });
}

export async function deleteKnowledge(params: {
  documentId: string;
  kbId?: string;
}): Promise<void> {
  const response = await fetch(`${resolveGatewayBaseUrl()}/api/knowledge/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify({ documentId: params.documentId, kbId: params.kbId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库删除失败");
  }
}

export async function listKnowledgeChunks(params: {
  documentId: string;
  kbId?: string;
  limit?: number;
  offset?: number;
}): Promise<KnowledgeChunksResponse> {
  const url = buildGatewayUrl("/api/knowledge/chunks");
  url.searchParams.set("documentId", params.documentId);
  if (params.kbId) url.searchParams.set("kbId", params.kbId);
  if (typeof params.limit === "number") url.searchParams.set("limit", String(params.limit));
  if (typeof params.offset === "number") url.searchParams.set("offset", String(params.offset));
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "分块列表加载失败");
  }
  return data as KnowledgeChunksResponse;
}

export async function getKnowledgeChunk(
  chunkId: string,
  kbId?: string,
): Promise<KnowledgeChunkDetailResponse> {
  const url = buildGatewayUrl("/api/knowledge/chunk");
  url.searchParams.set("chunkId", chunkId);
  if (kbId) url.searchParams.set("kbId", kbId);
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "分块详情加载失败");
  }
  return data as KnowledgeChunkDetailResponse;
}

export async function getKnowledgeSettings(): Promise<KnowledgeSettingsResponse> {
  const url = buildGatewayUrl("/api/knowledge/settings");
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "设置加载失败");
  }
  return data as KnowledgeSettingsResponse;
}

export async function getKnowledgeBaseSettings(
  kbId: string,
): Promise<{ kbId: string; settings: KnowledgeBaseRuntimeSettings }> {
  const url = buildGatewayUrl("/api/knowledge/base/settings");
  url.searchParams.set("kbId", kbId);
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库设置加载失败");
  }
  return data as { kbId: string; settings: KnowledgeBaseRuntimeSettings };
}

export async function updateKnowledgeBaseSettings(params: {
  kbId: string;
  settings: Partial<KnowledgeBaseRuntimeSettings>;
}): Promise<{ kbId: string; settings: KnowledgeBaseRuntimeSettings }> {
  const url = buildGatewayUrl("/api/knowledge/base/settings");
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "知识库设置更新失败");
  }
  return data as { kbId: string; settings: KnowledgeBaseRuntimeSettings };
}

export async function listKnowledgeTags(): Promise<{ tags: KnowledgeBaseTag[] }> {
  const url = buildGatewayUrl("/api/knowledge/tags");
  const response = await fetch(url.toString(), { headers: buildHeaders() });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "标签列表加载失败");
  }
  return data as { tags: KnowledgeBaseTag[] };
}

export async function createKnowledgeTag(params: {
  name: string;
  color?: string;
}): Promise<KnowledgeBaseTag> {
  const url = buildGatewayUrl("/api/knowledge/tags");
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "创建标签失败");
  }
  return data as KnowledgeBaseTag;
}

export async function updateKnowledgeTag(params: {
  tagId: string;
  name?: string;
  color?: string;
}): Promise<KnowledgeBaseTag> {
  const url = buildGatewayUrl("/api/knowledge/tags");
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "更新标签失败");
  }
  return data as KnowledgeBaseTag;
}

export async function deleteKnowledgeTag(tagId: string): Promise<{ success: boolean }> {
  const url = buildGatewayUrl("/api/knowledge/tags/delete");
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify({ tagId }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "删除标签失败");
  }
  return data as { success: boolean };
}

export async function updateKnowledgeSettings(params: {
  vectorization?: Partial<KnowledgeSettingsResponse["vectorization"]>;
  graph?: Partial<KnowledgeSettingsResponse["graph"]>;
}): Promise<KnowledgeSettingsResponse> {
  const url = buildGatewayUrl("/api/knowledge/settings");
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify(params),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || "设置更新失败");
  }
  return data as KnowledgeSettingsResponse;
}

export async function knowledgeSearch(params: {
  query: string;
  limit?: number;
  sessionKey?: string;
  kbId?: string | null;
}): Promise<KnowledgeSearchResponse> {
  const response = await fetch(`${resolveGatewayBaseUrl()}/api/tools/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(),
    },
    body: JSON.stringify({
      tool: "knowledge_search",
      args: {
        query: params.query,
        limit: params.limit,
        kbId: params.kbId ?? undefined,
      },
      sessionKey: params.sessionKey,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error?.message || "检索失败");
  }
  return data.result as KnowledgeSearchResponse;
}
