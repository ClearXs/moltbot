import { callGateway, buildAvatarUrl, withGatewayToken } from "@/services/gateway";
import { resolveGatewayHttpBase } from "@/services/gateway-config";

export interface AgentIdentity {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
  agentId?: string;
}

/**
 * Persona interface mapped from Gateway Agent info
 */
export interface Persona {
  id: string;
  name: string;
  identity?: AgentIdentity;
  avatarUrl?: string | null;
  isDefault?: boolean;
}

export interface PersonaMotion {
  idle_loop: string;
}

/**
 * Persona configuration interface
 */
export interface Config {
  /** Character setting file path */
  character_setting: string;

  /** Reference audio path for TTS */
  ref_audio?: string;

  /** Motion file paths */
  motion: PersonaMotion;

  /** VRM file path */
  vrm: string;

  /** Language configuration */
  prompt_lang?: string;
}

/**
 * Extended Persona interface with aggregated information
 */
export interface Personas extends Persona {
  character_setting?: string;
  config?: Config;
  r_path?: string;
  thumb?: string;
  activated?: boolean;
}

type AgentsListPayload = {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: Array<{
    id: string;
    name?: string;
    identity?: AgentIdentity;
  }>;
};

type AgentIdentityPayload = AgentIdentity;

let cachedDefaultAgentId: string | null = null;

export async function getDefaultAgentId(): Promise<string> {
  if (cachedDefaultAgentId) {
    return cachedDefaultAgentId;
  }
  const payload = await callGateway<AgentsListPayload>("agents.list");
  cachedDefaultAgentId = payload.defaultId;
  return cachedDefaultAgentId;
}

function mapPersona(agent: AgentsListPayload["agents"][number], defaultId: string): Persona {
  const name = agent.identity?.name?.trim() || agent.name?.trim() || agent.id;
  const rawAvatar = agent.identity?.avatarUrl ?? agent.identity?.avatar ?? null;
  let avatarUrl: string | null = null;
  if (rawAvatar && /^https?:\/\//i.test(rawAvatar)) {
    avatarUrl = rawAvatar;
  } else if (rawAvatar && rawAvatar.startsWith("/")) {
    avatarUrl = withGatewayToken(new URL(rawAvatar, resolveGatewayHttpBase()).toString());
  } else if (agent.id) {
    avatarUrl = buildAvatarUrl(agent.id);
  }
  return {
    id: agent.id,
    name,
    identity: agent.identity,
    avatarUrl,
    isDefault: agent.id === defaultId,
  };
}

/**
 * Persona API hook for managing persona operations
 */
const usePersonaApi = () => {
  /**
   * Get the currently activated persona
   */
  const getActivatePersona = async (): Promise<Persona | null> => {
    const payload = await callGateway<AgentsListPayload>("agents.list");
    const defaultAgent = payload.agents.find((agent) => agent.id === payload.defaultId);
    if (!defaultAgent) {
      return null;
    }
    cachedDefaultAgentId = payload.defaultId;
    return mapPersona(defaultAgent, payload.defaultId);
  };

  /**
   * Get list of all personas
   */
  const listPersonas = async (): Promise<Persona[]> => {
    const payload = await callGateway<AgentsListPayload>("agents.list");
    cachedDefaultAgentId = payload.defaultId;
    return payload.agents.map((agent) => mapPersona(agent, payload.defaultId));
  };

  /**
   * Create a new persona
   */
  const createPersona = async (): Promise<Persona> => {
    throw new Error("Persona creation is not available via Gateway yet.");
  };

  /**
   * Update an existing persona
   */
  const updatePersona = async (): Promise<Persona> => {
    throw new Error("Persona updates are not available via Gateway yet.");
  };

  /**
   * Delete a persona
   */
  const deletePersona = async (): Promise<boolean> => {
    throw new Error("Persona deletion is not available via Gateway yet.");
  };

  /**
   * Activate a specific persona
   */
  const activatePersona = async (): Promise<boolean> => {
    throw new Error("Persona activation is not available via Gateway yet.");
  };

  /**
   * Deactivate a specific persona
   */
  const deactivatePersona = async (): Promise<boolean> => {
    throw new Error("Persona deactivation is not available via Gateway yet.");
  };

  /**
   * Get a specific persona by ID
   */
  const getPersona = async (id: string): Promise<Personas> => {
    const payload = await callGateway<AgentIdentityPayload>("agent.identity.get", { agentId: id });
    const rawAvatar = payload.avatarUrl ?? payload.avatar ?? null;
    let avatarUrl: string | null = null;
    if (rawAvatar && /^https?:\/\//i.test(rawAvatar)) {
      avatarUrl = rawAvatar;
    } else if (rawAvatar && rawAvatar.startsWith("/")) {
      avatarUrl = withGatewayToken(new URL(rawAvatar, resolveGatewayHttpBase()).toString());
    } else {
      avatarUrl = buildAvatarUrl(id);
    }
    return {
      id,
      name: payload.name ?? id,
      identity: payload,
      avatarUrl,
    };
  };

  const updatePersonaConfig = async (): Promise<unknown> => {
    throw new Error("Persona config updates are not available via Gateway yet.");
  };

  return {
    getActivatePersona,
    listPersonas,
    createPersona,
    updatePersona,
    deletePersona,
    activatePersona,
    deactivatePersona,
    getPersona,
    updatePersonaConfig,
  };
};

export default usePersonaApi;
