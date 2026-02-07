import { GatewayBrowserClient } from "@/lib/gateway/client";
import { resolveGatewayHttpBase } from "@/services/gateway-config";
import { useConnectionStore } from "@/store/connection";

export function buildFileUrl(agentId: string, relativePath: string): string {
  const base = resolveGatewayHttpBase();
  const trimmed = relativePath.replace(/^\/+/, "");
  return withGatewayToken(`${base}/files/${agentId}/${trimmed}`);
}

export function buildAvatarUrl(agentId: string): string {
  const base = resolveGatewayHttpBase();
  return withGatewayToken(`${base}/avatar/${agentId}`);
}

export function withGatewayToken(url: string): string {
  const token = useConnectionStore.getState().gatewayToken;
  if (!token) {
    return url;
  }
  const next = new URL(url);
  next.searchParams.set("token", token);
  return next.toString();
}

export async function getGatewayClient(): Promise<GatewayBrowserClient> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Gateway client requires a browser environment"));
  }
  const state = useConnectionStore.getState();
  if (state.wsClient && state.wsClient.connected) {
    return state.wsClient;
  }
  await state.connect();
  const next = useConnectionStore.getState();
  if (!next.wsClient || !next.wsClient.connected) {
    throw new Error(next.lastError ?? "Gateway client unavailable");
  }
  return next.wsClient;
}

export async function callGateway<T>(method: string, params?: Record<string, unknown>) {
  const client = await getGatewayClient();
  return client.request<T>(method, params);
}

export async function callGatewayFinal<T>(
  method: string,
  params: Record<string, unknown>,
  isFinal: (payload: unknown) => boolean,
) {
  const client = await getGatewayClient();
  return client.requestFinal<T>(method, params, isFinal);
}
