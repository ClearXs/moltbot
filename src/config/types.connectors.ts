export type ConnectorType = "app" | "custom_api" | "custom_mcp";

export type ConnectorAuthMode = "none" | "api_key" | "oauth";

export type ConnectorStatus = "connected" | "disconnected" | "error" | "draft";

export type ConnectorTransport = "http" | "sse" | "stdio" | "websocket";

export type ConnectorOAuthState = {
  provider?: string;
  scopes?: string[];
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: number;
  connectedAt?: number;
};

export type ConnectorEntry = {
  type: ConnectorType;
  name?: string;
  description?: string;
  icon?: string;
  enabled?: boolean;
  authMode?: ConnectorAuthMode;
  status?: ConnectorStatus;
  config?: Record<string, unknown>;
  oauth?: ConnectorOAuthState;
  customApi?: {
    note?: string;
    secrets?: Record<string, string>;
  };
  customMcp?: {
    transport?: ConnectorTransport;
    serverUrl?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    note?: string;
  };
};

export type ConnectorSessionState = {
  connectorIds?: string[];
};

export type ConnectorOAuthProvider = {
  authorizeUrl?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  scopes?: string[];
  extraAuthorizeParams?: Record<string, string>;
  extraTokenParams?: Record<string, string>;
};

export type ConnectorsConfig = {
  entries?: Record<string, ConnectorEntry>;
  sessions?: Record<string, ConnectorSessionState>;
  oauthProviders?: Record<string, ConnectorOAuthProvider>;
};
