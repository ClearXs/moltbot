import { callGateway, buildFileUrl } from "@/services/gateway";
import { resolveGatewayHttpBase } from "@/services/gateway-config";
import { getDefaultAgentId } from "@/services/personas";
import { useConnectionStore } from "@/store/connection";

/**
 * Scene interface matching the Gateway scene model
 */
export interface Scene {
  id: string;
  name: string;
  description: string;
  r_path: string;
  main_file: string;
  thumb: string | null;
  active: boolean;
  updated_at: string;
  user_id: string;
  created_at: string;
}

export type SceneListResponse = {
  scenes: Scene[];
  activeSceneId: string | null;
};

/**
 * Scene creation data interface
 */
export interface SceneCreateData {
  name: string;
  description?: string;
  main_file: string;
  r_path: string;
  thumb?: string;
}

/**
 * Scene update data interface
 */
export interface SceneUpdateData {
  id: string;
  name?: string;
  description?: string;
  main_file?: string;
  r_path?: string;
  thumb?: string;
}

/**
 * Scene upsert data interface
 */
export interface SceneUpsertData {
  name: string;
  main_file: string;
  r_path: string;
  description?: string;
  thumb?: string;
}

export function buildSceneThumbUrl(agentId: string, scene: Scene): string | null {
  if (!scene.thumb) {
    return null;
  }
  return buildFileUrl(agentId, scene.thumb);
}

/**
 * Scene API hook for managing scene operations
 */
const useSceneApi = () => {
  /**
   * Get list of all scenes
   */
  const listScenes = async (agentIdOverride?: string): Promise<Scene[]> => {
    const agentId = agentIdOverride ?? (await getDefaultAgentId());
    const payload = await callGateway<SceneListResponse>("scenes.list", { agentId });
    const activeId = payload.activeSceneId ?? null;
    return payload.scenes.map((scene) => ({
      ...scene,
      active: activeId ? scene.id === activeId : scene.active,
    }));
  };

  /**
   * Get a specific scene by ID
   */
  const getSceneById = async (id: string): Promise<Scene> => {
    const agentId = await getDefaultAgentId();
    const payload = await callGateway<{ scene: Scene }>("scenes.get", {
      agentId,
      sceneId: id,
    });
    return payload.scene;
  };

  /**
   * Create a new scene
   */
  const createScene = async (sceneData: SceneCreateData): Promise<Scene> => {
    const agentId = await getDefaultAgentId();
    const payload = await callGateway<{ scene: Scene }>("scenes.create", {
      agentId,
      ...sceneData,
    });
    return payload.scene;
  };

  /**
   * Insert or update a scene
   */
  const upsertScene = async (sceneData: SceneUpsertData): Promise<Scene> => {
    const agentId = await getDefaultAgentId();
    const payload = await callGateway<{ scene: Scene }>("scenes.create", {
      agentId,
      ...sceneData,
    });
    return payload.scene;
  };

  /**
   * Update an existing scene
   */
  const updateScene = async (id: string, sceneData: Partial<SceneUpdateData>): Promise<Scene> => {
    const agentId = await getDefaultAgentId();
    const payload = await callGateway<{ scene: Scene }>("scenes.update", {
      agentId,
      sceneId: id,
      ...sceneData,
    });
    return payload.scene;
  };

  /**
   * Delete a scene
   */
  const deleteScene = async (id: string): Promise<{ success: true }> => {
    const agentId = await getDefaultAgentId();
    const payload = await callGateway<{ success: true }>("scenes.delete", {
      agentId,
      sceneId: id,
    });
    return payload;
  };

  /**
   * Set active scene
   */
  const setActiveScene = async (
    sceneId: string,
  ): Promise<{ success: true; activeSceneId: string | null }> => {
    const agentId = await getDefaultAgentId();
    const payload = await callGateway<{
      success: true;
      activeSceneId: string | null;
    }>("scenes.setActive", {
      agentId,
      sceneId,
    });
    return payload;
  };

  /**
   * Upload thumbnail for a scene
   */
  const uploadThumbnail = async () => {
    throw new Error("Thumbnail upload is not wired to Gateway uploads yet.");
  };

  const uploadSceneFiles = async (
    files: File[],
  ): Promise<{
    success: boolean;
    files: Array<{ filename: string; path: string }>;
  }> => {
    const agentId = await getDefaultAgentId();
    const base = resolveGatewayHttpBase();
    const url = new URL(`${base}/upload/${agentId}/scenes`);
    const formData = new FormData();
    for (const file of files) {
      formData.append("file", file);
    }
    const token = useConnectionStore.getState().gatewayToken;
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Upload failed");
    }
    return res.json();
  };

  const uploadVrmFile = async (
    file: File,
  ): Promise<{
    success: boolean;
    files: Array<{ filename: string; path: string }>;
  }> => {
    const agentId = await getDefaultAgentId();
    const base = resolveGatewayHttpBase();
    const url = new URL(`${base}/upload/${agentId}/vrm`);
    const formData = new FormData();
    formData.append("file", file);
    const token = useConnectionStore.getState().gatewayToken;
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Upload failed");
    }
    return res.json();
  };

  return {
    listScenes,
    getSceneById,
    createScene,
    upsertScene,
    updateScene,
    deleteScene,
    setActiveScene,
    uploadThumbnail,
    uploadSceneFiles,
    uploadVrmFile,
  };
};

export default useSceneApi;
