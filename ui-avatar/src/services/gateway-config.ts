const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";
const DEFAULT_HTTP_URL = "http://127.0.0.1:18789";
const GATEWAY_URL_STORAGE_KEY = "openclaw.gateway.url";

export function getStoredGatewayWsUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(GATEWAY_URL_STORAGE_KEY);
  return raw && raw.trim() ? raw.trim() : null;
}

export function setStoredGatewayWsUrl(url: string) {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = url.trim();
  if (trimmed) {
    localStorage.setItem(GATEWAY_URL_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(GATEWAY_URL_STORAGE_KEY);
  }
}

export function resolveGatewayWsUrl(): string {
  return (
    getStoredGatewayWsUrl() ||
    process.env.NEXT_PUBLIC_WS_URL?.trim() ||
    process.env.NEXT_PUBLIC_GATEWAY_URL?.trim() ||
    DEFAULT_GATEWAY_URL
  );
}

export function resolveGatewayHttpBase(): string {
  const explicit = process.env.NEXT_PUBLIC_GATEWAY_HTTP?.trim();
  if (explicit) {
    return explicit;
  }
  const wsUrl = resolveGatewayWsUrl();
  try {
    const parsed = new URL(wsUrl);
    const protocol = parsed.protocol === "wss:" ? "https:" : "http:";
    return `${protocol}//${parsed.host}`;
  } catch {
    return DEFAULT_HTTP_URL;
  }
}
