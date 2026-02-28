// Quota Gateway Handlers
// 提供配额状态查询和检查接口

import { loadConfig, writeConfigFile } from "../../config/config.js";
import { getUserQuota, checkQuota, getRemainingQuota } from "../../infra/token-quota.js";
import type { GatewayRequestHandlers } from "./types.js";

export const quotaHandlers: GatewayRequestHandlers = {
  "quota.status": async ({ respond, params }) => {
    const config = loadConfig();
    // 优先使用params中的userId，否则使用"default"
    const userId = (params?.userId as string | undefined) || "default";

    const quota = getUserQuota(userId, config);

    // 无限额 (未配置或 limit <= 0)
    if (!quota) {
      respond(
        true,
        {
          enabled: true,
          userId,
          unlimited: true,
          limit: null,
          spent: 0,
          remaining: null,
          spentPercent: 0,
        },
        undefined,
      );
      return;
    }

    const remaining = quota.limit - (quota.spent ?? 0);
    const spentPercent = ((quota.spent ?? 0) / quota.limit) * 100;

    respond(
      true,
      {
        enabled: true,
        userId,
        unlimited: false,
        limit: quota.limit,
        spent: quota.spent ?? 0,
        remaining,
        spentPercent: Math.round(spentPercent * 100) / 100,
      },
      undefined,
    );
  },

  "quota.check": async ({ respond, params }) => {
    const config = loadConfig();
    // 优先使用params中的userId，否则使用"default"
    const userId = (params?.userId as string | undefined) || "default";
    const amount = typeof params?.amount === "number" ? params.amount : 0;

    const allowed = checkQuota(userId, amount, config);
    const remaining = getRemainingQuota(userId, config);

    respond(true, { allowed, remaining: remaining ?? -1 }, undefined);
  },

  "quota.config.get": async ({ respond }) => {
    const config = loadConfig();
    respond(
      true,
      {
        enabled: config.quota?.enabled ?? false,
        modelPricing: config.modelPricing ?? {},
        users: config.quota?.users ?? {},
      },
      undefined,
    );
  },

  "quota.config.update": async ({ respond, params }) => {
    try {
      const config = loadConfig();
      const { enabled, modelPricing, users } = params as {
        enabled?: boolean;
        modelPricing?: Record<string, { input: number; output: number }>;
        users?: Record<string, { limit: number; spent: number }>;
      };

      if (enabled !== undefined) {
        config.quota = config.quota ?? {};
        config.quota.enabled = enabled;
      }

      if (modelPricing !== undefined) {
        config.modelPricing = modelPricing;
      }

      if (users !== undefined) {
        config.quota = config.quota ?? {};
        config.quota.users = users;
      }

      await writeConfigFile(config);
      respond(true, { updated: true }, undefined);
    } catch (e) {
      respond(false, undefined, {
        code: "CONFIG_UPDATE_FAILED",
        message: `Failed to update config: ${String(e)}`,
      });
    }
  },
};
