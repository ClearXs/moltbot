type StoredDeviceIdentity = {
  version: 1;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  createdAtMs: number;
};

export type DeviceIdentity = {
  deviceId: string;
  publicKey: string;
  privateKey: string;
};

type DeviceAuthPayloadParams = {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token?: string | null;
  nonce?: string | null;
  version?: "v1" | "v2";
};

const STORAGE_KEY = "openclaw.deviceIdentity.v1";

function base64UrlEncode(data: ArrayBuffer): string {
  const bytes = new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Uint8Array {
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function getStoredIdentity(): StoredDeviceIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredDeviceIdentity;
    if (
      parsed?.version === 1 &&
      typeof parsed.deviceId === "string" &&
      typeof parsed.publicKey === "string" &&
      typeof parsed.privateKey === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function storeIdentity(identity: StoredDeviceIdentity): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function getStoredDeviceIdentity(): DeviceIdentity | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  const stored = getStoredIdentity();
  if (!stored) {
    return null;
  }
  return {
    deviceId: stored.deviceId,
    publicKey: stored.publicKey,
    privateKey: stored.privateKey,
  };
}

export function resetDeviceIdentity(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

async function generateIdentity(): Promise<DeviceIdentity> {
  if (!crypto?.subtle) {
    throw new Error("WebCrypto is not available in this browser.");
  }
  const keyPair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const publicKeyRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyPkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const deviceId = await sha256Hex(publicKeyRaw);
  return {
    deviceId,
    publicKey: base64UrlEncode(publicKeyRaw),
    privateKey: base64UrlEncode(privateKeyPkcs8),
  };
}

export async function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity> {
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Device identity requires browser storage.");
  }
  const stored = getStoredIdentity();
  if (stored) {
    return {
      deviceId: stored.deviceId,
      publicKey: stored.publicKey,
      privateKey: stored.privateKey,
    };
  }
  const identity = await generateIdentity();
  storeIdentity({
    version: 1,
    deviceId: identity.deviceId,
    publicKey: identity.publicKey,
    privateKey: identity.privateKey,
    createdAtMs: Date.now(),
  });
  return identity;
}

export function buildDeviceAuthPayload(params: DeviceAuthPayloadParams): string {
  const version = params.version ?? (params.nonce ? "v2" : "v1");
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
  ];
  if (version === "v2") {
    base.push(params.nonce ?? "");
  }
  return base.join("|");
}

export async function signDevicePayload(
  privateKeyBase64Url: string,
  payload: string,
): Promise<string> {
  const keyData = base64UrlDecode(privateKeyBase64Url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const key = await crypto.subtle.importKey("pkcs8", keyData as any, { name: "Ed25519" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(payload));
  return base64UrlEncode(signature);
}
