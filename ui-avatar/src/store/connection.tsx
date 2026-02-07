import { create } from "zustand";
import { GatewayBrowserClient } from "@/lib/gateway/client";
import { resolveGatewayWsUrl, setStoredGatewayWsUrl } from "@/services/gateway-config";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type ConnectionStore = {
  status: ConnectionStatus;
  wsClient: GatewayBrowserClient | null;
  lastError: string | null;
  reconnectAttempts: number;
  lastConnectedAt: number | null;
  gatewayToken: string;
  gatewayUrl: string;
  pairingRequestId: string | null;
  pairingDeviceId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  reset: () => void;
  setGatewayToken: (token: string) => void;
  setGatewayUrl: (url: string) => void;
  clearPairingRequest: () => void;
};

const TOKEN_STORAGE_KEY = "openclaw.gateway.token";

const getInitialToken = (): string => {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_GATEWAY_TOKEN || "";
  }
  return localStorage.getItem(TOKEN_STORAGE_KEY) || process.env.NEXT_PUBLIC_GATEWAY_TOKEN || "";
};

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  status: "disconnected",
  wsClient: null,
  lastError: null,
  reconnectAttempts: 0,
  lastConnectedAt: null,
  gatewayToken: getInitialToken(),
  gatewayUrl: resolveGatewayWsUrl(),
  pairingRequestId: null,
  pairingDeviceId: null,
  connect: async () => {
    const { status, gatewayToken } = get();
    if (status === "connected") {
      return;
    }
    if (status === "connecting") {
      return;
    }

    set({ status: "connecting", lastError: null });

    const url = get().gatewayUrl || resolveGatewayWsUrl();
    await new Promise<void>((resolve, reject) => {
      let resolved = false;
      const timeout = window.setTimeout(() => {
        if (!resolved) {
          reject(new Error("Connection timeout"));
        }
      }, 12_000);

      const client = new GatewayBrowserClient({
        url,
        token: gatewayToken,
        onHello: () => {
          if (resolved) {
            return;
          }
          resolved = true;
          window.clearTimeout(timeout);
          set({
            status: "connected",
            lastError: null,
            reconnectAttempts: 0,
            lastConnectedAt: Date.now(),
            pairingRequestId: null,
            pairingDeviceId: null,
          });
          resolve();
        },
        onClose: (info) => {
          if (!resolved) {
            window.clearTimeout(timeout);
            reject(new Error(`Gateway closed (${info.code}): ${info.reason}`));
            return;
          }
          set({ status: "disconnected" });
        },
        onEvent: (evt) => {
          if (evt.event === "device.pair.requested") {
            const payload = evt.payload as { requestId?: string; deviceId?: string } | undefined;
            if (payload?.requestId) {
              set({
                pairingRequestId: payload.requestId,
                pairingDeviceId: payload.deviceId ?? null,
              });
            }
          }
        },
      });

      set({ wsClient: client });
      client.start();
    }).catch((error) => {
      get().wsClient?.stop();
      set({
        status: "error",
        lastError: error instanceof Error ? error.message : String(error),
        reconnectAttempts: get().reconnectAttempts + 1,
      });
    });
  },
  disconnect: () => {
    const { wsClient } = get();
    wsClient?.stop();
    set({
      status: "disconnected",
      wsClient: null,
      lastError: null,
      reconnectAttempts: 0,
    });
  },
  reset: () => {
    const { wsClient } = get();
    wsClient?.stop();
    set({
      status: "disconnected",
      wsClient: null,
      lastError: null,
      reconnectAttempts: 0,
      lastConnectedAt: null,
      pairingRequestId: null,
      pairingDeviceId: null,
    });
  },
  setGatewayToken: (token) => {
    const trimmed = token.trim();
    if (typeof window !== "undefined") {
      if (trimmed) {
        localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
    const { wsClient } = get();
    wsClient?.stop();
    set({
      gatewayToken: trimmed,
      wsClient: null,
      status: "disconnected",
      lastError: null,
      reconnectAttempts: 0,
    });
  },
  setGatewayUrl: (url) => {
    setStoredGatewayWsUrl(url);
    const { wsClient } = get();
    wsClient?.stop();
    set({
      gatewayUrl: resolveGatewayWsUrl(),
      wsClient: null,
      status: "disconnected",
      lastError: null,
      reconnectAttempts: 0,
    });
  },
  clearPairingRequest: () => {
    set({ pairingRequestId: null, pairingDeviceId: null });
  },
}));
