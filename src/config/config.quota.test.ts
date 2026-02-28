import { describe, it, expect } from "vitest";
import { validateConfigObject } from "./config.js";

describe("RMB quota config", () => {
  it("should load quota config from yaml", () => {
    const res = validateConfigObject({
      quota: {
        enabled: true,
        users: {
          alice: {
            limit: 100.5,
            spent: 50.25,
          },
          bob: {
            limit: 200,
            spent: 0,
          },
        },
      },
      modelPricing: {
        "claude-3-5-sonnet": {
          input: 3,
          output: 15,
        },
      },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.config.quota?.enabled).toBe(true);
      expect(res.config.quota?.users?.alice?.limit).toBe(100.5);
      expect(res.config.quota?.users?.alice?.spent).toBe(50.25);
      expect(res.config.modelPricing?.["claude-3-5-sonnet"]?.input).toBe(3);
    }
  });

  it("should accept quota without users", () => {
    const res = validateConfigObject({
      quota: {
        enabled: true,
      },
    });
    expect(res.ok).toBe(true);
  });

  it("should reject negative limit", () => {
    const res = validateConfigObject({
      quota: {
        enabled: true,
        users: {
          alice: {
            limit: -100,
          },
        },
      },
    });
    expect(res.ok).toBe(false);
  });
});
