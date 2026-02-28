import { NextRequest, NextResponse } from "next/server";

type ImportResult = {
  ok: true;
  item: {
    name: string;
    description?: string;
    config: Record<string, unknown>;
  };
};

function decodeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

function extractStringField(html: string, key: string): string | undefined {
  const regex = new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`);
  const match = html.match(regex);
  if (!match?.[1]) return undefined;
  return decodeJsonString(match[1]).trim();
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function buildCustomMcpConfig(html: string): Record<string, unknown> {
  const serverConfigRaw = extractStringField(html, "server_config");
  if (serverConfigRaw) {
    const parsed = tryParseJson(serverConfigRaw);
    if (parsed && typeof parsed === "object") {
      const mcpServers = (parsed as { mcpServers?: Record<string, unknown> }).mcpServers;
      if (mcpServers && typeof mcpServers === "object") {
        const first = Object.values(mcpServers)[0];
        if (first && typeof first === "object") {
          const cfg = first as Record<string, unknown>;
          const transport = typeof cfg.type === "string" ? cfg.type.toLowerCase() : undefined;
          const config: Record<string, unknown> = {};
          if (transport === "sse" || transport === "http" || transport === "websocket") {
            config.transport = transport;
            if (typeof cfg.url === "string" && cfg.url.trim()) {
              config.serverUrl = cfg.url.trim();
            }
            if (cfg.headers && typeof cfg.headers === "object") {
              config.headers = cfg.headers;
            }
            return config;
          }
          if (typeof cfg.command === "string" && cfg.command.trim()) {
            config.transport = "stdio";
            config.command = cfg.command.trim();
            if (Array.isArray(cfg.args)) config.args = cfg.args;
            if (cfg.env && typeof cfg.env === "object") config.env = cfg.env;
            return config;
          }
        }
      }
    }
  }

  const serverCommand = extractStringField(html, "server_command");
  const serverParamsRaw = extractStringField(html, "server_params");
  const config: Record<string, unknown> = {};
  if (serverCommand) {
    config.transport = "stdio";
    config.command = serverCommand;
  }
  if (serverParamsRaw) {
    const params = tryParseJson(serverParamsRaw);
    if (params && typeof params === "object") {
      config.env = params;
    }
  }
  return config;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body?.url?.trim();
    if (!rawUrl) {
      return NextResponse.json({ ok: false, error: "missing url" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid url" }, { status: 400 });
    }
    if (parsed.hostname !== "mcp.so") {
      return NextResponse.json({ ok: false, error: "only mcp.so is supported" }, { status: 400 });
    }
    if (!parsed.pathname.startsWith("/server/")) {
      return NextResponse.json(
        { ok: false, error: "url must be a mcp.so server page" },
        { status: 400 },
      );
    }

    const resp = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "OpenClaw-Connector-Importer/1.0",
      },
      cache: "no-store",
    });
    if (!resp.ok) {
      return NextResponse.json(
        { ok: false, error: `fetch failed: ${resp.status}` },
        { status: 502 },
      );
    }
    const html = await resp.text();

    const name =
      extractStringField(html, "title") ||
      extractStringField(html, "name") ||
      parsed.pathname.split("/").filter(Boolean)[1] ||
      "Imported MCP";
    const description = extractStringField(html, "description");
    const config = buildCustomMcpConfig(html);

    const result: ImportResult = {
      ok: true,
      item: {
        name,
        description,
        config,
      },
    };
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 },
    );
  }
}
