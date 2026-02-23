import { describe, expect, it, vi } from "vitest";

let currentConfig: Record<string, unknown> = {
  connectors: {
    entries: {},
    sessions: {},
  },
};

vi.mock("../../config/config.js", () => {
  return {
    loadConfig: () => currentConfig,
    writeConfigFile: async (cfg: unknown) => {
      currentConfig = cfg as Record<string, unknown>;
    },
  };
});

const { connectorsHandlers } = await import("./connectors.js");

describe("connectors.session.set", () => {
  it("deduplicates connector ids and persists session mapping", async () => {
    currentConfig = { connectors: { entries: {}, sessions: {} } };

    let ok: boolean | null = null;
    let payload: unknown = null;
    await connectorsHandlers["connectors.session.set"]({
      params: {
        sessionKey: "agent:main:main",
        connectorIds: ["github", "github", "notion"],
      },
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond: (success, result) => {
        ok = success;
        payload = result;
      },
    });

    expect(ok).toBe(true);
    expect(payload).toMatchObject({
      ok: true,
      connectorIds: ["github", "notion"],
    });
    expect(currentConfig).toMatchObject({
      connectors: {
        sessions: {
          "agent:main:main": {
            connectorIds: ["github", "notion"],
          },
        },
      },
    });
  });
});

describe("connectors.list", () => {
  it("includes built-in connectors", async () => {
    currentConfig = { connectors: { entries: {}, sessions: {} } };

    let ok: boolean | null = null;
    let payload: unknown = null;
    await connectorsHandlers["connectors.list"]({
      params: {},
      req: {} as never,
      client: null as never,
      isWebchatConnect: () => false,
      context: {} as never,
      respond: (success, result) => {
        ok = success;
        payload = result;
      },
    });

    expect(ok).toBe(true);
    expect(payload).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: "github", type: "app" }),
        expect.objectContaining({ id: "gmail", type: "app" }),
      ]),
    });
  });
});
