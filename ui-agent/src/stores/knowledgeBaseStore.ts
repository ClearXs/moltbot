import { create } from "zustand";
import type {
  KnowledgeChunk,
  KnowledgeDetail,
  KnowledgeDocument,
  KnowledgeBase,
  KnowledgeSearchResult,
  KnowledgeSettingsResponse,
} from "@/services/knowledgeApi";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBase,
  deleteKnowledge,
  getKnowledge,
  listKnowledge,
  listKnowledgeBases,
  listKnowledgeChunks,
  updateKnowledgeBase,
  updateKnowledgeMetadata,
  uploadKnowledge,
  getKnowledgeSettings,
  updateKnowledgeSettings,
} from "@/services/knowledgeApi";

interface KnowledgeFilters {
  tags: string[];
}

interface KnowledgeBaseState {
  kbsById: Record<string, KnowledgeBase>;
  kbIds: string[];
  kbTotal: number;
  kbOffset: number;
  kbLimit: number;
  activeKbId: string | null;
  kbDetail: KnowledgeBase | null;
  isLoadingKbList: boolean;
  isLoadingKbDetail: boolean;
  isCreatingKb: boolean;
  isUpdatingKb: boolean;
  isDeletingKb: boolean;

  documentsById: Record<string, KnowledgeDocument>;
  documentIds: string[];
  total: number;
  offset: number;
  limit: number;
  activeDocumentId: string | null;
  filters: KnowledgeFilters;
  isLoadingList: boolean;
  isLoadingDetail: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  detail: KnowledgeDetail | null;
  chunksById: Record<string, KnowledgeChunk>;
  chunkIds: string[];
  chunkTotal: number;
  chunkOffset: number;
  chunkLimit: number;
  activeChunkId: string | null;
  isLoadingChunks: boolean;
  settings: KnowledgeSettingsResponse | null;
  isLoadingSettings: boolean;
  isUpdatingSettings: boolean;
  searchResults: KnowledgeSearchResult[];
  searchQuery: string;
  targetChunkId: string | null;
  searchHighlightKeywords: string[];

  loadKbList: (params?: {
    offset?: number;
    limit?: number;
    search?: string;
    visibility?: "private" | "team" | "public";
  }) => Promise<void>;
  selectKb: (kbId: string | null) => Promise<void>;
  createKb: (params: {
    name: string;
    description?: string;
    icon?: string;
    visibility?: "private" | "team" | "public";
  }) => Promise<void>;
  updateKb: (params: {
    kbId: string;
    name?: string;
    description?: string;
    icon?: string;
    visibility?: "private" | "team" | "public";
  }) => Promise<void>;
  deleteKb: (kbId: string) => Promise<void>;

  loadDocuments: (params?: {
    offset?: number;
    limit?: number;
    tags?: string[];
    kbId?: string | null;
  }) => Promise<void>;
  selectDocument: (id: string | null) => Promise<void>;
  loadChunks: (documentId: string, params?: { offset?: number; limit?: number }) => Promise<void>;
  selectChunk: (chunkId: string | null) => void;
  loadSettings: () => Promise<void>;
  updateSettings: (params: {
    vectorization?: Partial<KnowledgeSettingsResponse["vectorization"]>;
    graph?: Partial<KnowledgeSettingsResponse["graph"]>;
  }) => Promise<void>;
  setTags: (tags: string[]) => void;
  setSearchResults: (results: KnowledgeSearchResult[], query: string) => void;
  clearSearch: () => void;
  navigateToSearchResult: (result: KnowledgeSearchResult) => Promise<void>;
  clearTargetChunk: () => void;
  uploadDocument: (file: File, description?: string, tags?: string[]) => Promise<void>;
  updateDocumentMetadata: (params: {
    documentId: string;
    filename?: string;
    description?: string;
    tags?: string[];
  }) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set, get) => ({
  kbsById: {},
  kbIds: [],
  kbTotal: 0,
  kbOffset: 0,
  kbLimit: 20,
  activeKbId: null,
  kbDetail: null,
  isLoadingKbList: false,
  isLoadingKbDetail: false,
  isCreatingKb: false,
  isUpdatingKb: false,
  isDeletingKb: false,

  documentsById: {},
  documentIds: [],
  total: 0,
  offset: 0,
  limit: 20,
  activeDocumentId: null,
  filters: { tags: [] },
  isLoadingList: false,
  isLoadingDetail: false,
  isUploading: false,
  isDeleting: false,
  detail: null,
  chunksById: {},
  chunkIds: [],
  chunkTotal: 0,
  chunkOffset: 0,
  chunkLimit: 50,
  activeChunkId: null,
  isLoadingChunks: false,
  settings: null,
  isLoadingSettings: false,
  isUpdatingSettings: false,
  searchResults: [],
  searchQuery: "",
  targetChunkId: null,
  searchHighlightKeywords: [],

  loadKbList: async (params) => {
    const { kbLimit } = get();
    const nextLimit = params?.limit ?? kbLimit;
    const nextOffset = params?.offset ?? 0;
    set({ isLoadingKbList: true });
    try {
      const result = await listKnowledgeBases({
        limit: nextLimit,
        offset: nextOffset,
        search: params?.search,
        visibility: params?.visibility,
      });
      const kbsById: Record<string, KnowledgeBase> = {};
      const kbIds = result.kbs.map((kb) => {
        kbsById[kb.kbId] = kb;
        return kb.kbId;
      });
      set({
        kbsById,
        kbIds,
        kbTotal: result.total,
        kbOffset: result.offset,
        kbLimit: nextLimit,
      });
    } finally {
      set({ isLoadingKbList: false });
    }
  },

  selectKb: async (kbId) => {
    if (!kbId) {
      set({
        activeKbId: null,
        kbDetail: null,
        documentsById: {},
        documentIds: [],
        total: 0,
        offset: 0,
        activeDocumentId: null,
        detail: null,
        chunksById: {},
        chunkIds: [],
        chunkTotal: 0,
        chunkOffset: 0,
        activeChunkId: null,
        searchResults: [],
        searchQuery: "",
        targetChunkId: null,
        searchHighlightKeywords: [],
      });
      return;
    }
    set({
      activeKbId: kbId,
      isLoadingKbDetail: true,
      documentsById: {},
      documentIds: [],
      total: 0,
      offset: 0,
      activeDocumentId: null,
      detail: null,
      chunksById: {},
      chunkIds: [],
      chunkTotal: 0,
      chunkOffset: 0,
      activeChunkId: null,
      searchResults: [],
      searchQuery: "",
      targetChunkId: null,
      searchHighlightKeywords: [],
    });
    try {
      const kbDetail = await getKnowledgeBase(kbId);
      set({ kbDetail });
    } finally {
      set({ isLoadingKbDetail: false });
    }
  },

  createKb: async (params) => {
    set({ isCreatingKb: true });
    try {
      await createKnowledgeBase(params);
      await get().loadKbList({ offset: 0 });
    } finally {
      set({ isCreatingKb: false });
    }
  },

  updateKb: async (params) => {
    set({ isUpdatingKb: true });
    try {
      const updated = await updateKnowledgeBase(params);
      set((state) => ({
        kbsById: { ...state.kbsById, [updated.kbId]: updated },
        kbDetail: state.activeKbId === updated.kbId ? updated : state.kbDetail,
      }));
    } finally {
      set({ isUpdatingKb: false });
    }
  },

  deleteKb: async (kbId) => {
    set({ isDeletingKb: true });
    try {
      await deleteKnowledgeBase(kbId);
      await get().loadKbList({ offset: 0 });
      if (get().activeKbId === kbId) {
        get().selectKb(null);
      }
    } finally {
      set({ isDeletingKb: false });
    }
  },

  loadDocuments: async (params) => {
    const { filters, limit } = get();
    const nextLimit = params?.limit ?? limit;
    const nextOffset = params?.offset ?? 0;
    const tags = params?.tags ?? filters.tags;
    const kbId = params?.kbId ?? get().activeKbId ?? undefined;
    if (!kbId) {
      set({
        documentsById: {},
        documentIds: [],
        total: 0,
        offset: 0,
        isLoadingList: false,
      });
      return;
    }
    set({ isLoadingList: true });
    try {
      const result = await listKnowledge({
        kbId: kbId ?? undefined,
        tags,
        limit: nextLimit,
        offset: nextOffset,
      });
      const documentsById: Record<string, KnowledgeDocument> = {};
      const documentIds = result.documents.map((doc) => {
        documentsById[doc.id] = doc;
        return doc.id;
      });
      set({
        documentsById,
        documentIds,
        total: result.total,
        offset: result.offset,
        limit: nextLimit,
        filters: { tags },
      });
    } finally {
      set({ isLoadingList: false });
    }
  },

  selectDocument: async (id) => {
    if (!id) {
      set({
        activeDocumentId: null,
        detail: null,
        chunksById: {},
        chunkIds: [],
        chunkTotal: 0,
        chunkOffset: 0,
        activeChunkId: null,
      });
      return;
    }
    set({ activeDocumentId: id, isLoadingDetail: true });
    try {
      const detail = await getKnowledge(id, get().activeKbId ?? undefined);
      set({ detail });
    } finally {
      set({ isLoadingDetail: false });
    }
  },

  loadChunks: async (documentId, params) => {
    const { chunkLimit } = get();
    const nextLimit = params?.limit ?? chunkLimit;
    const nextOffset = params?.offset ?? 0;
    set({ isLoadingChunks: true });
    try {
      const result = await listKnowledgeChunks({
        documentId,
        kbId: get().activeKbId ?? undefined,
        limit: nextLimit,
        offset: nextOffset,
      });
      const chunksById: Record<string, KnowledgeChunk> = {};
      const chunkIds = result.chunks.map((chunk) => {
        chunksById[chunk.id] = chunk;
        return chunk.id;
      });
      set({
        chunksById,
        chunkIds,
        chunkTotal: result.total,
        chunkOffset: result.offset,
        chunkLimit: nextLimit,
      });
    } finally {
      set({ isLoadingChunks: false });
    }
  },

  selectChunk: (chunkId) => set({ activeChunkId: chunkId }),

  loadSettings: async () => {
    set({ isLoadingSettings: true });
    try {
      const settings = await getKnowledgeSettings();
      set({ settings });
    } finally {
      set({ isLoadingSettings: false });
    }
  },

  updateSettings: async (params) => {
    set({ isUpdatingSettings: true });
    try {
      const settings = await updateKnowledgeSettings(params);
      set({ settings });
    } finally {
      set({ isUpdatingSettings: false });
    }
  },

  setTags: (tags) => set({ filters: { tags } }),

  setSearchResults: (results, query) => {
    const searchHighlightKeywords = query
      .trim()
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    set({
      searchResults: results,
      searchQuery: query,
      searchHighlightKeywords,
    });
  },

  clearSearch: () => {
    set({
      searchResults: [],
      searchQuery: "",
      searchHighlightKeywords: [],
      targetChunkId: null,
    });
  },

  navigateToSearchResult: async (result) => {
    const { selectDocument, loadChunks } = get();
    await selectDocument(result.documentId);
    if (result.chunkId) {
      set({ targetChunkId: result.chunkId });
      await loadChunks(result.documentId, { offset: 0 });
    }
  },

  clearTargetChunk: () => {
    set({ targetChunkId: null });
  },

  uploadDocument: async (file, description, tags) => {
    const kbId = get().activeKbId;
    if (!kbId) {
      throw new Error("请先选择知识库");
    }
    set({ isUploading: true });
    try {
      await uploadKnowledge({ kbId, file, description, tags });
      await get().loadDocuments({ offset: 0 });
    } finally {
      set({ isUploading: false });
    }
  },

  updateDocumentMetadata: async ({ documentId, filename, description, tags }) => {
    const kbId = get().activeKbId;
    if (!kbId) {
      throw new Error("请先选择知识库");
    }
    const updated = await updateKnowledgeMetadata({
      kbId,
      documentId,
      filename,
      description,
      tags,
    });
    set((state) => ({
      detail: state.activeDocumentId === documentId ? updated : state.detail,
      documentsById: state.documentsById[documentId]
        ? {
            ...state.documentsById,
            [documentId]: {
              ...state.documentsById[documentId],
              filename: updated.filename,
              description: updated.description,
              tags: updated.tags,
            },
          }
        : state.documentsById,
    }));
  },

  deleteDocument: async (id) => {
    set({ isDeleting: true });
    try {
      await deleteKnowledge({ documentId: id, kbId: get().activeKbId ?? undefined });
      await get().loadDocuments({ offset: 0 });
      if (get().activeDocumentId === id) {
        set({ activeDocumentId: null, detail: null });
      }
    } finally {
      set({ isDeleting: false });
    }
  },
}));
