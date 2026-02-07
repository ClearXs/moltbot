/**
 * Clawdbot WebSocket Client
 * Handles connection, authentication, and RPC communication with Clawdbot Gateway
 */

import type {
  WSMessage,
  WSRequest,
  WSResponse,
  WSEvent,
  ConnectParams,
  HelloPayload,
  ConnectChallengePayload,
} from "../types/clawdbot";
import {
  buildDeviceAuthPayload,
  loadOrCreateDeviceIdentity,
  signDevicePayload,
} from "./device-identity";

type EventHandler = (payload: unknown) => void;
type ResponseHandler = (response: WSResponse) => void;

export interface ClawdbotWebSocketClientOptions {
  url: string;
  token?: string;
  clientId?: string;
  clientVersion?: string;
  locale?: string;
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Clawdbot WebSocket Client
 * Manages WebSocket connection and provides RPC-style API
 */
export class ClawdbotWebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<ClawdbotWebSocketClientOptions>;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private responseHandlers: Map<string, ResponseHandler> = new Map();
  private requestIdCounter = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isClosedManually = false;
  private connectNonce: string | null = null;

  constructor(options: ClawdbotWebSocketClientOptions) {
    // Merge with defaults
    this.options = {
      url: options.url,
      token: options.token || "",
      clientId: options.clientId || "ui-agent-web",
      clientVersion: options.clientVersion || "1.0.0",
      locale: options.locale || "zh-CN",
      autoReconnect: options.autoReconnect !== false,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      reconnectDelay: options.reconnectDelay || 1000,
      onConnected: options.onConnected || (() => {}),
      onDisconnected: options.onDisconnected || (() => {}),
      onError: options.onError || (() => {}),
    };
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.warn("[ClawdbotWS] Already connected");
      return;
    }

    if (this.isConnecting) {
      console.warn("[ClawdbotWS] Connection already in progress");
      return;
    }

    this.isConnecting = true;
    this.isClosedManually = false;
    this.connectNonce = null;

    return new Promise((resolve, reject) => {
      try {
        console.log(`[ClawdbotWS] Connecting to ${this.options.url}...`);
        this.ws = new WebSocket(this.options.url);

        this.ws.onopen = () => {
          console.log("[ClawdbotWS] WebSocket opened");
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          // Wait for challenge before resolving
        };

        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data) as WSMessage;
            await this.handleMessage(message, resolve, reject);
          } catch (error) {
            console.error("[ClawdbotWS] Failed to parse message:", error);
            this.options.onError(error as Error);
          }
        };

        this.ws.onerror = (event) => {
          console.error("[ClawdbotWS] WebSocket error:", event);
          this.isConnecting = false;
          const error = new Error("WebSocket connection error");
          this.options.onError(error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`[ClawdbotWS] WebSocket closed: ${event.code} ${event.reason}`);
          this.isConnecting = false;
          this.ws = null;
          this.options.onDisconnected();

          // Auto-reconnect if not closed manually
          if (!this.isClosedManually && this.options.autoReconnect) {
            this.scheduleReconnect();
          }
        };

        // Connection timeout
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error("Connection timeout"));
            this.ws?.close();
          }
        }, 10000); // 10 second timeout
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(
    message: WSMessage,
    connectResolve?: (value: void) => void,
    connectReject?: (reason: Error) => void,
  ): Promise<void> {
    if (message.type === "event") {
      const event = message as WSEvent;

      // Handle connect.challenge
      if (event.event === "connect.challenge") {
        const payload = event.payload as ConnectChallengePayload;
        console.log("[ClawdbotWS] Received challenge:", payload);
        this.connectNonce = payload.nonce;
        try {
          await this.sendConnectRequest();
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          this.options.onError(err);
          connectReject?.(err);
        }
      }

      // Notify event handlers
      const handlers = this.eventHandlers.get(event.event);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(event.payload);
          } catch (error) {
            console.error(`[ClawdbotWS] Error in event handler for ${event.event}:`, error);
          }
        });
      }
    } else if (message.type === "res") {
      const response = message as WSResponse;

      // Handle connect response
      if (response.id.startsWith("connect-")) {
        if (response.ok) {
          const payload = response.payload as HelloPayload;
          console.log("[ClawdbotWS] Connected successfully, protocol:", payload.protocol);
          this.options.onConnected();
          connectResolve?.();
        } else {
          const error = new Error(response.error?.message || "Connection failed");
          console.error("[ClawdbotWS] Connection failed:", error);
          this.options.onError(error);
          connectReject?.(error);
        }
      }

      // Notify response handler
      const handler = this.responseHandlers.get(response.id);
      if (handler) {
        handler(response);
        this.responseHandlers.delete(response.id);
      }
    }
  }

  /**
   * Send connect request after receiving challenge
   */
  private async sendConnectRequest(): Promise<void> {
    const role = "operator";
    const scopes = ["operator.read", "operator.write", "operator.admin"];
    const params: ConnectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.options.clientId,
        version: this.options.clientVersion,
        platform: "web",
        mode: "webchat", // Required: must be one of the predefined modes
      },
      role,
      scopes,
      locale: this.options.locale,
    };

    // Add auth token if provided
    if (this.options.token) {
      params.auth = {
        token: this.options.token,
      };
    }

    const signedAt = Date.now();
    try {
      const identity = await loadOrCreateDeviceIdentity();
      const payload = buildDeviceAuthPayload({
        deviceId: identity.deviceId,
        clientId: params.client.id,
        clientMode: params.client.mode,
        role,
        scopes,
        signedAtMs: signedAt,
        token: this.options.token || null,
        nonce: this.connectNonce,
      });
      const signature = await signDevicePayload(identity.privateKey, payload);
      params.device = {
        id: identity.deviceId,
        publicKey: identity.publicKey,
        signature,
        signedAt,
        nonce: this.connectNonce || undefined,
      };
    } catch (error) {
      if (!this.options.token) {
        throw error;
      }
      console.warn("[ClawdbotWS] Device identity unavailable, falling back to token auth.");
    }

    const request: WSRequest = {
      type: "req",
      id: `connect-${Date.now()}`,
      method: "connect",
      params: params as unknown as Record<string, unknown>,
    };

    console.log("[ClawdbotWS] Sending connect request:", JSON.stringify(params, null, 2));
    this.send(request);
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.isClosedManually = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error("[ClawdbotWS] Max reconnect attempts reached");
      this.options.onError(new Error("Max reconnect attempts reached"));
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, ..., max 30s
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      30000,
    );

    console.log(
      `[ClawdbotWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})...`,
    );
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error("[ClawdbotWS] Reconnect failed:", error);
      });
    }, delay);
  }

  /**
   * Send a raw WebSocket message
   */
  private send(message: WSRequest | WSMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send an RPC request and wait for response
   */
  async sendRequest<TPayload = unknown>(
    method: string,
    params?: Record<string, unknown> | ConnectParams,
  ): Promise<TPayload> {
    const id = `req-${++this.requestIdCounter}-${Date.now()}`;
    const request: WSRequest = {
      type: "req",
      id,
      method,
      params: params as Record<string, unknown>,
    };

    return new Promise((resolve, reject) => {
      // Set up response handler
      this.responseHandlers.set(id, (response) => {
        if (response.ok) {
          resolve(response.payload as TPayload);
        } else {
          reject(new Error(response.error?.message || `Request ${method} failed`));
        }
      });

      // Send request
      try {
        this.send(request);
      } catch (error) {
        this.responseHandlers.delete(id);
        reject(error);
      }

      // Request timeout (60 seconds)
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
          reject(new Error(`Request ${method} timeout`));
        }
      }, 60000);
    });
  }

  /**
   * Add an event listener
   */
  addEventListener(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Remove an event listener
   */
  removeEventListener(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
      }
    }
  }

  /**
   * Remove all event listeners for a specific event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.eventHandlers.delete(event);
    } else {
      this.eventHandlers.clear();
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current connection state
   */
  getReadyState(): number | null {
    return this.ws?.readyState ?? null;
  }
}
