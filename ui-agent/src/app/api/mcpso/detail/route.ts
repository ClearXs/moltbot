import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function decodeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

function extractStringField(source: string, key: string): string | undefined {
  const plainRegex = new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`);
  const escapedRegex = new RegExp(`\\\\"${key}\\\\":\\\\"((?:\\\\\\\\.|[^"\\\\])*)\\\\"`);
  const match = source.match(plainRegex) ?? source.match(escapedRegex);
  if (!match?.[1]) return undefined;
  return decodeJsonString(match[1]).trim() || undefined;
}

function decodeTokenText(value: string): string {
  return value
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .trim();
}

function extractTokenText(html: string, ref: string): string | undefined {
  const regex = new RegExp(`${ref}:T[0-9a-f]+,([\\s\\S]*?)(?=\\n[0-9a-z]+:|<\\/script>)`);
  const match = html.match(regex);
  if (!match?.[1]) return undefined;
  return decodeTokenText(match[1]);
}

function buildServerConfigText(html: string): string | undefined {
  const raw = extractStringField(html, "server_config");
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export async function GET(request: NextRequest) {
  try {
    const rawUrl = request.nextUrl.searchParams.get("url")?.trim();
    if (!rawUrl) {
      return NextResponse.json({ ok: false, error: "missing url" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json({ ok: false, error: "invalid url" }, { status: 400 });
    }

    if (parsed.hostname !== "mcp.so" || !parsed.pathname.startsWith("/server/")) {
      return NextResponse.json(
        { ok: false, error: "url must be a mcp.so server page" },
        { status: 400 },
      );
    }

    const resp = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "OpenClaw-MCP-Detail/1.0",
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

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const metaDescMatch = html.match(/<meta name="description" content="([^"]*)"/i);
    const title = titleMatch?.[1]?.replace(/\s*MCP Server\s*$/i, "").trim() || "MCP";
    const description = decodeJsonString(metaDescMatch?.[1] ?? "").trim() || undefined;

    const summaryRef =
      html.match(/"summary":"\$([0-9a-z]+)"/)?.[1] ??
      html.match(/\\"summary\\":\\"\$([0-9a-z]+)\\"/)?.[1];
    const contentRef =
      html.match(/"content":"\$([0-9a-z]+)"/)?.[1] ??
      html.match(/\\"content\\":\\"\$([0-9a-z]+)\\"/)?.[1];

    const summary = summaryRef ? extractTokenText(html, summaryRef) : undefined;
    const content = contentRef ? extractTokenText(html, contentRef) : undefined;
    const serverConfigText = buildServerConfigText(html);
    const authorName = extractStringField(html, "author_name");
    const repoUrl = extractStringField(html, "url");

    return NextResponse.json({
      ok: true,
      item: {
        title,
        description,
        summary,
        content,
        serverConfigText,
        authorName,
        repoUrl,
        serverPageUrl: parsed.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 },
    );
  }
}
