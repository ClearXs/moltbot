import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type McpSoSearchItem = {
  name: string;
  title: string;
  description?: string;
  authorName?: string;
  repoUrl?: string;
  serverPageUrl?: string;
};

function decodeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw;
  }
}

function extractNearbyField(source: string, key: string): string | undefined {
  const plainRegex = new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`);
  const escapedRegex = new RegExp(`\\\\"${key}\\\\":\\\\"((?:\\\\\\\\.|[^"\\\\])*)\\\\"`);
  const match = source.match(plainRegex) ?? source.match(escapedRegex);
  if (!match?.[1]) return undefined;
  const decoded = decodeJsonString(match[1]).trim();
  return decoded || undefined;
}

function uniqueByUrl(items: McpSoSearchItem[]): McpSoSearchItem[] {
  const seen = new Set<string>();
  const out: McpSoSearchItem[] = [];
  for (const item of items) {
    const key = item.serverPageUrl || `${item.name}:${item.repoUrl || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "30");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 30;
    const pageRaw = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;

    const pageUrl = new URL("https://mcp.so/servers");
    if (query) {
      pageUrl.searchParams.set("q", query);
    }
    if (page > 1) {
      pageUrl.searchParams.set("page", String(page));
    }

    const resp = await fetch(pageUrl.toString(), {
      headers: {
        "User-Agent": "OpenClaw-MCP-Search/1.0",
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

    const serverPageByName = new Map<string, string>();
    const pagePathRegex = /\/server\/([^"\/<]+)\/([^"\/<]+)/g;
    let pagePathMatch: RegExpExecArray | null;
    while ((pagePathMatch = pagePathRegex.exec(html)) !== null) {
      const slug = decodeURIComponent(pagePathMatch[1]);
      const author = decodeURIComponent(pagePathMatch[2]);
      if (!serverPageByName.has(slug)) {
        serverPageByName.set(slug, `https://mcp.so/server/${slug}/${author}`);
      }
    }

    const parsed: McpSoSearchItem[] = [];

    const plainEntryRegex =
      /"name":"((?:\\.|[^"\\])*)","title":"((?:\\.|[^"\\])*)","description":"((?:\\.|[^"\\])*)"/g;
    const escapedEntryRegex =
      /\\"name\\":\\"((?:\\\\.|[^"\\])*)\\",\\"title\\":\\"((?:\\\\.|[^"\\])*)\\",\\"description\\":\\"((?:\\\\.|[^"\\])*)\\"/g;

    const collectEntries = (regex: RegExp, unescapeSlash: boolean) => {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(html)) !== null) {
        const rawName = unescapeSlash ? match[1].replace(/\\\\/g, "\\") : match[1];
        const rawTitle = unescapeSlash ? match[2].replace(/\\\\/g, "\\") : match[2];
        const rawDesc = unescapeSlash ? match[3].replace(/\\\\/g, "\\") : match[3];

        const name = decodeJsonString(rawName).trim();
        const title = decodeJsonString(rawTitle).trim();
        const description = decodeJsonString(rawDesc).trim();
        if (!name || !title) continue;

        const nearby = html.slice(match.index, Math.min(match.index + 4500, html.length));
        const authorName = extractNearbyField(nearby, "author_name");
        const repoUrl = extractNearbyField(nearby, "url");
        const serverPageUrl =
          serverPageByName.get(name) ||
          (authorName
            ? `https://mcp.so/server/${encodeURIComponent(name)}/${encodeURIComponent(authorName)}`
            : undefined);

        parsed.push({
          name,
          title,
          description: description || undefined,
          authorName,
          repoUrl,
          serverPageUrl,
        });
      }
    };

    collectEntries(plainEntryRegex, false);
    if (parsed.length < 10) {
      collectEntries(escapedEntryRegex, true);
    }

    const fallbackItems =
      parsed.length === 0
        ? Array.from(serverPageByName.entries()).map(([name, serverPageUrl]) => ({
            name,
            title: name,
            serverPageUrl,
          }))
        : parsed;

    const filtered = query
      ? fallbackItems.filter((item) => {
          const q = query.toLowerCase();
          return (
            item.name.toLowerCase().includes(q) ||
            item.title.toLowerCase().includes(q) ||
            ("description" in item && item.description
              ? item.description.toLowerCase().includes(q)
              : false) ||
            ("authorName" in item && item.authorName
              ? item.authorName.toLowerCase().includes(q)
              : false)
          );
        })
      : fallbackItems;

    const items = uniqueByUrl(filtered).slice(0, limit);
    const itemsWithDescription = items.map((item) => {
      const description = item.description?.trim();
      return {
        ...item,
        description: description || undefined,
      };
    });

    const totalPagesMatch = html.match(/\\?"totalPages\\?":\s*(\d+)/);
    const totalPages = totalPagesMatch ? Number(totalPagesMatch[1]) : undefined;
    const hasMore =
      typeof totalPages === "number"
        ? page < totalPages
        : itemsWithDescription.length >= Math.max(20, Math.floor(limit * 0.5));

    return NextResponse.json({ ok: true, items: itemsWithDescription, page, totalPages, hasMore });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown error" },
      { status: 500 },
    );
  }
}
