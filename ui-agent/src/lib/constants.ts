export const API_ENDPOINTS = {
  CHAT: "/api/chat",
  CHATS: "/api/chats",
  AGENT: "/api/agent",
  AGENT_STATUS: "/api/agent/status",
  AGENT_START: "/api/agent/start",
  AGENT_STOP: "/api/agent/stop",
  WEBSOCKET: "/ws",
} as const;

export const UI_CONSTANTS = {
  SIDEBAR_WIDTH: 320,
  HEADER_HEIGHT: 64,
  MESSAGE_LIMIT: 100,
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 3000,
} as const;

export const KEYBOARD_SHORTCUTS = {
  SEND_MESSAGE: "Enter",
  NEW_LINE: "Shift+Enter",
  TOGGLE_SIDEBAR: "Cmd+B",
  FOCUS_INPUT: "Cmd+K",
} as const;
