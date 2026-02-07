import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import type { ResolvedZaloAccount } from "./types.js";
import { handleZaloWebhookRequest, registerZaloWebhookTarget } from "./monitor.js";

function createMockReqRes(params: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}) {
  const req = Readable.from([params.body]) as IncomingMessage;
  req.url = params.url;
  req.method = params.method;
  req.headers = params.headers;

  class MockResponse extends EventEmitter {
    statusCode = 200;
    headers: Record<string, string> = {};
    body = "";

    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    }

    end(chunk?: unknown) {
      if (chunk !== undefined && typeof chunk === "string") {
        this.body += chunk;
      } else if (chunk !== undefined) {
        this.body += JSON.stringify(chunk);
      }
      this.emit("finish");
    }
  }

  const res = new MockResponse() as unknown as ServerResponse;
  return { req, res };
}

describe("handleZaloWebhookRequest", () => {
  it("returns 400 for non-object payloads", async () => {
    const core = {} as PluginRuntime;
    const account: ResolvedZaloAccount = {
      accountId: "default",
      enabled: true,
      token: "tok",
      tokenSource: "config",
      config: {},
    };
    const unregister = registerZaloWebhookTarget({
      token: "tok",
      account,
      config: {} as OpenClawConfig,
      runtime: {},
      core,
      secret: "secret",
      path: "/hook",
      mediaMaxMb: 5,
    });

    try {
      const { req, res } = createMockReqRes({
        url: "/hook",
        method: "POST",
        headers: {
          "x-bot-api-secret-token": "secret",
        },
        body: "null",
      });

      const handled = await handleZaloWebhookRequest(req, res);
      if (!handled) {
        res.statusCode = 404;
        res.end("not found");
      }

      expect(res.statusCode).toBe(400);
    } finally {
      unregister();
    }
  });
});
