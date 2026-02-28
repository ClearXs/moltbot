import { describe, it, expect, vi, beforeEach } from "vitest";
import { quotaHandlers } from "./quota.js";

// Mock dependencies
vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../../infra/token-quota.js", () => ({
  getUserQuota: vi.fn(),
  checkQuota: vi.fn(),
  getRemainingQuota: vi.fn(),
}));

import { loadConfig } from "../../config/config.js";
import { getUserQuota, checkQuota, getRemainingQuota } from "../../infra/token-quota.js";

const mockLoadConfig = loadConfig as ReturnType<typeof vi.fn>;
const mockGetUserQuota = getUserQuota as ReturnType<typeof vi.fn>;
const mockCheckQuota = checkQuota as ReturnType<typeof vi.fn>;
const mockGetRemainingQuota = getRemainingQuota as ReturnType<typeof vi.fn>;

describe("quota.status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("应返回用户配额状态", () => {
    mockLoadConfig.mockReturnValue({
      quota: { enabled: true, users: { alice: { limit: 100, spent: 50 } } },
    } as unknown);
    mockGetUserQuota.mockReturnValue({ limit: 100, spent: 50 });

    const respond = vi.fn();
    const params = { userId: "alice" };

    // @ts-ignore - calling handler directly
    void quotaHandlers["quota.status"]({ respond, params });

    expect(respond).toHaveBeenCalledWith(
      true,
      {
        enabled: true,
        userId: "alice",
        unlimited: false,
        limit: 100,
        spent: 50,
        remaining: 50,
        spentPercent: 50,
      },
      undefined,
    );
  });

  it("无限额应返回 unlimited: true", () => {
    mockLoadConfig.mockReturnValue({ quota: { enabled: true } } as unknown);
    mockGetUserQuota.mockReturnValue(undefined);

    const respond = vi.fn();
    const params = { userId: "alice" };

    // @ts-ignore
    void quotaHandlers["quota.status"]({ respond, params });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        unlimited: true,
        limit: null,
      }),
      undefined,
    );
  });

  it("userId 为空应使用默认用户", () => {
    mockLoadConfig.mockReturnValue({ quota: { enabled: true } } as unknown);
    mockGetUserQuota.mockReturnValue(undefined);

    const respond = vi.fn();
    const params = {};

    // @ts-ignore
    void quotaHandlers["quota.status"]({ respond, params });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        userId: "default",
        unlimited: true,
      }),
      undefined,
    );
  });
});

describe("quota.check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("配额足够应返回 allowed: true", () => {
    mockLoadConfig.mockReturnValue({} as unknown);
    mockCheckQuota.mockReturnValue(true);
    mockGetRemainingQuota.mockReturnValue(50);

    const respond = vi.fn();
    const params = { userId: "alice", amount: 10 };

    // @ts-ignore
    void quotaHandlers["quota.check"]({ respond, params });

    expect(respond).toHaveBeenCalledWith(true, { allowed: true, remaining: 50 }, undefined);
  });

  it("配额不足应返回 allowed: false", () => {
    mockLoadConfig.mockReturnValue({} as unknown);
    mockCheckQuota.mockReturnValue(false);
    mockGetRemainingQuota.mockReturnValue(5);

    const respond = vi.fn();
    const params = { userId: "alice", amount: 10 };

    // @ts-ignore
    void quotaHandlers["quota.check"]({ respond, params });

    expect(respond).toHaveBeenCalledWith(true, { allowed: false, remaining: 5 }, undefined);
  });

  it("userId 为空应使用默认用户", () => {
    mockLoadConfig.mockReturnValue({} as unknown);
    mockCheckQuota.mockReturnValue(false);
    mockGetRemainingQuota.mockReturnValue(5);

    const respond = vi.fn();
    const params = { amount: 10 };

    // @ts-ignore
    void quotaHandlers["quota.check"]({ respond, params });

    expect(respond).toHaveBeenCalledWith(true, { allowed: false, remaining: 5 }, undefined);
  });
});
