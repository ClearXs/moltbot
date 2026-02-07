import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import {
  computeTargetTriples,
  extractTriplesViaLlm,
  type KnowledgeGraphSettings,
} from "./knowledge-graph.js";

vi.mock("../agents/pi-embedded.js", () => ({
  runEmbeddedPiAgent: vi.fn(async () => ({
    payloads: [
      {
        text:
          '{"h":{"name":"A"},"r":{"type":"rel"},"t":{"name":"B"}}\n' +
          '{"h":{"name":"B"},"r":{"type":"rel"},"t":{"name":"C"}}\n',
      },
    ],
  })),
}));

describe("knowledge-graph", () => {
  const settings: KnowledgeGraphSettings = {
    enabled: true,
    extractor: "llm",
    minTriples: 5,
    maxTriples: 50,
    triplesPerKTokens: 10,
    maxDepth: 2,
  };

  it("computes target triples based on text size", () => {
    const short = computeTargetTriples({ text: "short text", settings });
    expect(short).toBeGreaterThanOrEqual(settings.minTriples);
    const longText = "x".repeat(20_000);
    const long = computeTargetTriples({ text: longText, settings });
    expect(long).toBeGreaterThanOrEqual(short);
    expect(long).toBeLessThanOrEqual(settings.maxTriples);
  });

  it("extracts triples via LLM and parses JSONL", async () => {
    const cfg = { agents: { defaults: {} } } as OpenClawConfig;
    const result = await extractTriplesViaLlm({
      text: "alpha beta gamma",
      settings,
      cfg,
      agentId: "agent-1",
      workspaceDir: "/tmp",
      agentDir: "/tmp",
    });
    expect(result.triples.length).toBeGreaterThan(0);
    expect(result.triples[0]).toHaveProperty("h");
    expect(result.triples[0]).toHaveProperty("r");
    expect(result.triples[0]).toHaveProperty("t");
  });
});
