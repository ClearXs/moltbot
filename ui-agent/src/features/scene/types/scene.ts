// Scene types

export interface Scene {
  id: string;
  name: string;
  description?: string;
  r_path?: string;
  main_file?: string;
  thumb?: string;
  agentId?: string;
}
