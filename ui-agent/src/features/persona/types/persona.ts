// Persona types - maps to moltbot Agent

export interface Persona {
  id: string;
  name: string;
  activated?: boolean;
  r_path?: string;
  thumb?: string;
  character_setting?: string;
  config?: PersonaConfig;
}

export interface PersonaConfig {
  character_setting?: string;
  ref_audio?: string;
  motion?: {
    idle_loop?: string;
  };
  vrm?: string;
  prompt_lang?: string;
}

// For creating/updating persona
export interface PersonaFormData {
  name: string;
  activated?: boolean;
  character_setting?: string;
  config?: {
    vrm?: string;
    ref_audio?: string;
    motion?: {
      idle_loop?: string;
    };
    prompt_lang?: string;
  };
}

// Gateway API response types
export interface AgentIdentity {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
}

export interface AgentInfo {
  id: string;
  name?: string;
  description?: string;
  agent_type?: string;
  system?: string;
  topic?: string;
  tags?: string[];
  activated?: boolean;
  identity?: AgentIdentity;
  memorySearch?: Record<string, unknown>;
}
