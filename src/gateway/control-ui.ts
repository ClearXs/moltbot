import type { IncomingMessage, ServerResponse } from "node:http";
import busboy from "busboy";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenClawConfig } from "../config/config.js";
import { listAgentIds } from "../agents/agent-scope.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { DEFAULT_ASSISTANT_IDENTITY, resolveAssistantIdentity } from "./assistant-identity.js";
import { authorizeGatewayConnect, type ResolvedGatewayAuth } from "./auth.js";
import {
  buildControlUiAvatarUrl,
  CONTROL_UI_AVATAR_PREFIX,
  normalizeControlUiBasePath,
  resolveAssistantAvatarUrl,
} from "./control-ui-shared.js";
import { sendUnauthorized } from "./http-common.js";
import { getBearerToken, getHeader } from "./http-utils.js";

const ROOT_PREFIX = "/";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type ControlUiRequestOptions = {
  basePath?: string;
  config?: OpenClawConfig;
  agentId?: string;
};

type ControlUiAuthOptions = {
  auth: ResolvedGatewayAuth;
  trustedProxies?: string[];
  config: OpenClawConfig;
};

function resolveControlUiRoot(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const execDir = (() => {
    try {
      return path.dirname(fs.realpathSync(process.execPath));
    } catch {
      return null;
    }
  })();
  const candidates = [
    // Packaged app: control-ui lives alongside the executable.
    execDir ? path.resolve(execDir, "control-ui") : null,
    // Running from dist: dist/gateway/control-ui.js -> dist/control-ui
    path.resolve(here, "../control-ui"),
    // Running from source: src/gateway/control-ui.ts -> dist/control-ui
    path.resolve(here, "../../dist/control-ui"),
    // Fallback to cwd (dev)
    path.resolve(process.cwd(), "dist", "control-ui"),
  ].filter((dir): dir is string => Boolean(dir));
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

function contentTypeForExt(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".vrm":
    case ".glb":
      return "model/gltf-binary";
    case ".gltf":
      return "model/gltf+json";
    case ".fbx":
      return "application/octet-stream";
    default:
      return "application/octet-stream";
  }
}

export type ControlUiAvatarResolution =
  | { kind: "none"; reason: string }
  | { kind: "local"; filePath: string }
  | { kind: "remote"; url: string }
  | { kind: "data"; url: string };

type ControlUiAvatarMeta = {
  avatarUrl: string | null;
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(JSON.stringify(body));
}

function isValidAgentId(agentId: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(agentId);
}

function normalizeAllowedAgentId(agentId: string, config: OpenClawConfig): string | null {
  const normalized = normalizeAgentId(agentId);
  const allowed = new Set(listAgentIds(config));
  return allowed.has(normalized) ? normalized : null;
}

function resolveHttpAuthToken(req: IncomingMessage, url: URL): string | undefined {
  const bearer = getBearerToken(req);
  if (bearer) {
    return bearer;
  }
  const headerToken = getHeader(req, "x-openclaw-token")?.trim();
  if (headerToken) {
    return headerToken;
  }
  const queryToken = url.searchParams.get("token")?.trim();
  return queryToken || undefined;
}

async function ensureAuthorizedRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: ControlUiAuthOptions,
  url: URL,
): Promise<boolean> {
  const token = resolveHttpAuthToken(req, url);
  const authResult = await authorizeGatewayConnect({
    auth: opts.auth,
    connectAuth: token ? { token, password: token } : null,
    req,
    trustedProxies: opts.trustedProxies,
  });
  if (!authResult.ok) {
    sendUnauthorized(res);
    return false;
  }
  return true;
}

function respondForbidden(res: ServerResponse) {
  res.statusCode = 403;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Forbidden");
}

export async function handleControlUiAvatarRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: {
    basePath?: string;
    resolveAvatar: (agentId: string) => ControlUiAvatarResolution;
  } & ControlUiAuthOptions,
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }

  const url = new URL(urlRaw, "http://localhost");
  const basePath = normalizeControlUiBasePath(opts.basePath);
  const pathname = url.pathname;
  const pathWithBase = basePath
    ? `${basePath}${CONTROL_UI_AVATAR_PREFIX}/`
    : `${CONTROL_UI_AVATAR_PREFIX}/`;
  if (!pathname.startsWith(pathWithBase)) {
    return false;
  }

  const agentIdParts = pathname.slice(pathWithBase.length).split("/").filter(Boolean);
  const agentId = agentIdParts[0] ?? "";
  if (agentIdParts.length !== 1 || !agentId || !isValidAgentId(agentId)) {
    respondNotFound(res);
    return true;
  }

  if (!(await ensureAuthorizedRequest(req, res, opts, url))) {
    return true;
  }
  const normalizedAgentId = normalizeAllowedAgentId(agentId, opts.config);
  if (!normalizedAgentId) {
    respondForbidden(res);
    return true;
  }

  if (url.searchParams.get("meta") === "1") {
    const resolved = opts.resolveAvatar(normalizedAgentId);
    const avatarUrl =
      resolved.kind === "local"
        ? buildControlUiAvatarUrl(basePath, normalizedAgentId)
        : resolved.kind === "remote" || resolved.kind === "data"
          ? resolved.url
          : null;
    sendJson(res, 200, { avatarUrl } satisfies ControlUiAvatarMeta);
    return true;
  }

  const resolved = opts.resolveAvatar(normalizedAgentId);
  if (resolved.kind !== "local") {
    respondNotFound(res);
    return true;
  }

  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeForExt(path.extname(resolved.filePath).toLowerCase()));
    res.setHeader("Cache-Control", "no-cache");
    res.end();
    return true;
  }

  serveFile(res, resolved.filePath);
  return true;
}

/**
 * Handle requests for agent workspace files (VRM models, scene assets, etc.)
 * Route pattern: /files/{agentId}/{path}
 */
export async function handleAgentWorkspaceFileRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { basePath?: string; resolveWorkspace: (agentId: string) => string } & ControlUiAuthOptions,
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return false;
  }

  const url = new URL(urlRaw, "http://localhost");
  const basePath = normalizeControlUiBasePath(opts.basePath);
  const pathname = url.pathname;
  const pathWithBase = basePath ? `${basePath}/files/` : "/files/";
  if (!pathname.startsWith(pathWithBase)) {
    return false;
  }

  const remainingPath = pathname.slice(pathWithBase.length);
  const parts = remainingPath.split("/").filter(Boolean);
  if (parts.length < 2) {
    respondNotFound(res);
    return true;
  }

  const agentId = parts[0];
  if (!agentId || !isValidAgentId(agentId)) {
    respondNotFound(res);
    return true;
  }

  if (!(await ensureAuthorizedRequest(req, res, opts, url))) {
    return true;
  }
  const normalizedAgentId = normalizeAllowedAgentId(agentId, opts.config);
  if (!normalizedAgentId) {
    respondForbidden(res);
    return true;
  }

  // Reconstruct the file path relative to workspace
  const relativePath = parts.slice(1).join("/");
  const workspaceDir = opts.resolveWorkspace(normalizedAgentId);
  const fullPath = path.join(workspaceDir, relativePath);

  // Security check: ensure the resolved path is within the workspace
  const realWorkspace = fs.realpathSync(workspaceDir);
  let realFile: string;
  try {
    realFile = fs.realpathSync(fullPath);
  } catch {
    respondNotFound(res);
    return true;
  }

  if (!realFile.startsWith(realWorkspace)) {
    respondNotFound(res);
    return true;
  }

  // Verify it's a file
  try {
    const stat = fs.statSync(realFile);
    if (!stat.isFile()) {
      respondNotFound(res);
      return true;
    }
  } catch {
    respondNotFound(res);
    return true;
  }

  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypeForExt(path.extname(realFile).toLowerCase()));
    res.setHeader("Cache-Control", "no-cache");
    res.end();
    return true;
  }

  serveFile(res, realFile);
  return true;
}

/**
 * Handle file upload requests for agent workspace
 * Route pattern: /upload/{agentId}/:type
 */
export async function handleAgentFileUploadRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts: { basePath?: string; resolveWorkspace: (agentId: string) => string } & ControlUiAuthOptions,
): Promise<boolean> {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }
  if (req.method !== "POST") {
    return false;
  }

  const url = new URL(urlRaw, "http://localhost");
  const basePath = normalizeControlUiBasePath(opts.basePath);
  const pathname = url.pathname;
  const pathWithBase = basePath ? `${basePath}/upload/` : "/upload/";
  if (!pathname.startsWith(pathWithBase)) {
    return false;
  }

  const remainingPath = pathname.slice(pathWithBase.length);
  const parts = remainingPath.split("/").filter(Boolean);
  if (parts.length !== 2) {
    respondError(res, 400, "Invalid upload path");
    return true;
  }

  const [agentId, uploadType] = parts;
  if (!agentId || !isValidAgentId(agentId)) {
    respondError(res, 400, "Invalid agent ID");
    return true;
  }

  if (uploadType !== "vrm" && uploadType !== "scenes") {
    respondError(res, 400, "Invalid upload type. Must be 'vrm' or 'scenes'");
    return true;
  }

  if (!(await ensureAuthorizedRequest(req, res, opts, url))) {
    return true;
  }
  const normalizedAgentId = normalizeAllowedAgentId(agentId, opts.config);
  if (!normalizedAgentId) {
    respondForbidden(res);
    return true;
  }

  // Get workspace directory
  const workspaceDir = opts.resolveWorkspace(normalizedAgentId);

  // Parse multipart/form-data
  const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_UPLOAD_BYTES } });
  const uploadedFiles: Array<{ filename: string; path: string }> = [];
  let hasError = false;

  bb.on(
    "file",
    (
      _fieldname: string,
      file: NodeJS.ReadableStream,
      info: { filename: string; mimeType: string },
    ) => {
      if (hasError) {
        file.resume();
        return;
      }
      const { filename } = info;
      if (!filename) {
        file.resume();
        return;
      }

      // Validate file extension based on upload type
      const ext = path.extname(filename).toLowerCase();
      if (uploadType === "vrm") {
        if (![".vrm", ".glb", ".gltf", ".fbx"].includes(ext)) {
          hasError = true;
          file.resume();
          respondError(res, 400, `Invalid file type for VRM upload: ${ext}`);
          return;
        }
      } else if (uploadType === "scenes") {
        if (![".json", ".glb", ".gltf", ".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
          hasError = true;
          file.resume();
          respondError(res, 400, `Invalid file type for scene upload: ${ext}`);
          return;
        }
      }

      file.on("limit", () => {
        if (hasError || res.writableEnded) {
          return;
        }
        hasError = true;
        respondError(res, 413, `File too large (max ${MAX_UPLOAD_BYTES} bytes)`);
        file.resume();
      });

      // Generate safe filename
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const targetDir =
        uploadType === "vrm"
          ? path.join(workspaceDir, "custom/vrm")
          : [".png", ".jpg", ".jpeg", ".webp"].includes(ext)
            ? path.join(workspaceDir, "custom/scenes/thumbs")
            : path.join(workspaceDir, "custom/scenes");

      try {
        fs.mkdirSync(targetDir, { recursive: true });
      } catch (err) {
        hasError = true;
        respondError(res, 500, `Failed to create upload directory: ${String(err)}`);
        file.resume();
        return;
      }

      const filePath = path.join(targetDir, safeFilename);

      // Write file to disk
      const writeStream = fs.createWriteStream(filePath);
      file.pipe(writeStream);

      writeStream.on("finish", () => {
        uploadedFiles.push({ filename: safeFilename, path: filePath });
      });

      writeStream.on("error", (err) => {
        if (hasError || res.writableEnded) {
          return;
        }
        hasError = true;
        respondError(res, 500, `File write error: ${String(err)}`);
      });
    },
  );

  bb.on("finish", () => {
    if (hasError || res.writableEnded) {
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        success: true,
        files: uploadedFiles.map((f) => ({
          filename: f.filename,
          path: path.relative(workspaceDir, f.path),
        })),
      }),
    );
  });

  bb.on("error", (err: Error) => {
    if (hasError || res.writableEnded) {
      return;
    }
    respondError(res, 400, `Upload error: ${String(err)}`);
  });

  req.pipe(bb);
  return true;
}

function respondNotFound(res: ServerResponse) {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not Found");
}

function respondError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: message }));
}

function serveFile(res: ServerResponse, filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader("Content-Type", contentTypeForExt(ext));
  // Static UI should never be cached aggressively while iterating; allow the
  // browser to revalidate.
  res.setHeader("Cache-Control", "no-cache");
  res.end(fs.readFileSync(filePath));
}

interface ControlUiInjectionOpts {
  basePath: string;
  assistantName?: string;
  assistantAvatar?: string;
}

function injectControlUiConfig(html: string, opts: ControlUiInjectionOpts): string {
  const { basePath, assistantName, assistantAvatar } = opts;
  const script =
    `<script>` +
    `window.__OPENCLAW_CONTROL_UI_BASE_PATH__=${JSON.stringify(basePath)};` +
    `window.__OPENCLAW_ASSISTANT_NAME__=${JSON.stringify(
      assistantName ?? DEFAULT_ASSISTANT_IDENTITY.name,
    )};` +
    `window.__OPENCLAW_ASSISTANT_AVATAR__=${JSON.stringify(
      assistantAvatar ?? DEFAULT_ASSISTANT_IDENTITY.avatar,
    )};` +
    `</script>`;
  // Check if already injected
  if (html.includes("__OPENCLAW_ASSISTANT_NAME__")) {
    return html;
  }
  const headClose = html.indexOf("</head>");
  if (headClose !== -1) {
    return `${html.slice(0, headClose)}${script}${html.slice(headClose)}`;
  }
  return `${script}${html}`;
}

interface ServeIndexHtmlOpts {
  basePath: string;
  config?: OpenClawConfig;
  agentId?: string;
}

function serveIndexHtml(res: ServerResponse, indexPath: string, opts: ServeIndexHtmlOpts) {
  const { basePath, config, agentId } = opts;
  const identity = config
    ? resolveAssistantIdentity({ cfg: config, agentId })
    : DEFAULT_ASSISTANT_IDENTITY;
  const resolvedAgentId =
    typeof (identity as { agentId?: string }).agentId === "string"
      ? (identity as { agentId?: string }).agentId
      : agentId;
  const avatarValue =
    resolveAssistantAvatarUrl({
      avatar: identity.avatar,
      agentId: resolvedAgentId,
      basePath,
    }) ?? identity.avatar;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  const raw = fs.readFileSync(indexPath, "utf8");
  res.end(
    injectControlUiConfig(raw, {
      basePath,
      assistantName: identity.name,
      assistantAvatar: avatarValue,
    }),
  );
}

function isSafeRelativePath(relPath: string) {
  if (!relPath) {
    return false;
  }
  const normalized = path.posix.normalize(relPath);
  if (normalized.startsWith("../") || normalized === "..") {
    return false;
  }
  if (normalized.includes("\0")) {
    return false;
  }
  return true;
}

export function handleControlUiHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  opts?: ControlUiRequestOptions,
): boolean {
  const urlRaw = req.url;
  if (!urlRaw) {
    return false;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method Not Allowed");
    return true;
  }

  const url = new URL(urlRaw, "http://localhost");
  const basePath = normalizeControlUiBasePath(opts?.basePath);
  const pathname = url.pathname;

  if (!basePath) {
    if (pathname === "/ui" || pathname.startsWith("/ui/")) {
      respondNotFound(res);
      return true;
    }
  }

  if (basePath) {
    if (pathname === basePath) {
      res.statusCode = 302;
      res.setHeader("Location", `${basePath}/${url.search}`);
      res.end();
      return true;
    }
    if (!pathname.startsWith(`${basePath}/`)) {
      return false;
    }
  }

  const root = resolveControlUiRoot();
  if (!root) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(
      "Control UI assets not found. Build them with `pnpm ui:build` (auto-installs UI deps), or run `pnpm ui:dev` during development.",
    );
    return true;
  }

  const uiPath =
    basePath && pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length) : pathname;
  const rel = (() => {
    if (uiPath === ROOT_PREFIX) {
      return "";
    }
    const assetsIndex = uiPath.indexOf("/assets/");
    if (assetsIndex >= 0) {
      return uiPath.slice(assetsIndex + 1);
    }
    return uiPath.slice(1);
  })();
  const requested = rel && !rel.endsWith("/") ? rel : `${rel}index.html`;
  const fileRel = requested || "index.html";
  if (!isSafeRelativePath(fileRel)) {
    respondNotFound(res);
    return true;
  }

  const filePath = path.join(root, fileRel);
  if (!filePath.startsWith(root)) {
    respondNotFound(res);
    return true;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (path.basename(filePath) === "index.html") {
      serveIndexHtml(res, filePath, {
        basePath,
        config: opts?.config,
        agentId: opts?.agentId,
      });
      return true;
    }
    serveFile(res, filePath);
    return true;
  }

  // SPA fallback (client-side router): serve index.html for unknown paths.
  const indexPath = path.join(root, "index.html");
  if (fs.existsSync(indexPath)) {
    serveIndexHtml(res, indexPath, {
      basePath,
      config: opts?.config,
      agentId: opts?.agentId,
    });
    return true;
  }

  respondNotFound(res);
  return true;
}
