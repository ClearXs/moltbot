# Token 配额管理功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 Token 配额管理功能，包括配置、费用计算、额度检查、异步扣减和 UI 显示

**Tech Stack:** TypeScript, Vitest, React

---

## 实施阶段

### Phase 1: 配置层

#### Task 1.1: 添加配额配置 Schema

**Files:**

- Modify: `src/config/zod-schema.ts`
- Test: `src/config/config.quota.test.ts` (新建)

**Step 1: Write the failing test**

```typescript
// src/config/config.quota.test.ts
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

describe("RMB quota config", () => {
  it("should load quota config from yaml", async () => {
    const config = await loadConfig({
      configText: `
quota:
  enabled: true
  users:
    alice:
      limit: 100.5
      spent: 50.25
    bob:
      limit: 200
      spent: 0
modelPricing:
  claude-3-5-sonnet:
    input: 3
    output: 15
`,
    });
    expect(config.quota?.enabled).toBe(true);
    expect(config.quota?.users?.alice?.limit).toBe(100.5);
    expect(config.quota?.users?.alice?.spent).toBe(50.25);
    expect(config.modelPricing?.["claude-3-5-sonnet"]?.input).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/config/config.quota.test.ts`
Expected: FAIL

**Step 3: Add schema to zod-schema.ts**

在 `src/config/zod-schema.ts` 末尾添加：

```typescript
// Model Pricing Schema (价格单位: USD/百万tokens)
const ModelPricingSchema = z
  .record(
    z.string(),
    z
      .object({
        input: z.number().positive().optional(),
        output: z.number().positive().optional(),
      })
      .strict(),
  )
  .optional();

// Token Quota Schema (金额单位: RMB)
const TokenQuotaUserSchema = z
  .object({
    limit: z.number().positive(),
    spent: z.number().nonnegative().optional(),
  })
  .strict();

const TokenQuotaSchema = z
  .object({
    enabled: z.boolean().optional(),
    users: z.record(z.string(), TokenQuotaUserSchema).optional(),
  })
  .strict();
```

然后在 `OpenClawSchema` 中添加：

```typescript
quota: TokenQuotaSchema.optional(),
modelPricing: ModelPricingSchema.optional(),
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/config/config.quota.test.ts`
Expected: PASS

**Step 5: Commit**

---

### Phase 2: 核心模块

#### Task 2.1: 创建 token-quota 核心模块

**Files:**

- Create: `src/infra/token-quota.ts`
- Test: `src/infra/token-quota.test.ts` (新建)

**Step 1: Write the failing test**

```typescript
// src/infra/token-quota.test.ts
import { describe, it, expect } from "vitest";
import { getUserQuota, checkQuota, calculateCost, USD_TO_CNY } from "./token-quota.js";

describe("token-quota", () => {
  const testConfig = {
    quota: { enabled: true, users: { testuser: { limit: 100, spent: 50 } } },
    modelPricing: { "claude-3-5-sonnet": { input: 3, output: 15 } },
  } as any;

  describe("getUserQuota", () => {
    it("应返回用户配额", () => {
      expect(getUserQuota("testuser", testConfig)).toEqual({ limit: 100, spent: 50 });
    });

    it("功能关闭应返回 undefined", () => {
      const config = { quota: { enabled: false } } as any;
      expect(getUserQuota("testuser", config)).toBeUndefined();
    });

    it("无限额(limit<=0)应返回 undefined", () => {
      const config = {
        quota: { enabled: true, users: { alice: { limit: 0, spent: 100 } } },
      } as any;
      expect(getUserQuota("alice", config)).toBeUndefined();
    });
  });

  describe("checkQuota", () => {
    it("配额足够应返回 true", () => {
      expect(checkQuota("testuser", 30, testConfig)).toBe(true);
    });

    it("配额不足应返回 false", () => {
      expect(checkQuota("testuser", 60, testConfig)).toBe(false);
    });

    it("无限额应返回 true", () => {
      expect(checkQuota("newuser", 1000, testConfig)).toBe(true);
    });
  });

  describe("calculateCost", () => {
    it("应正确计算费用", () => {
      // 100000 * 3 / 1000000 + 50000 * 15 / 1000000 = 1.05 USD = 7.56 CNY
      const cost = calculateCost(100000, 50000, "claude-3-5-sonnet", testConfig);
      expect(cost).toBeCloseTo(7.56, 1);
    });

    it("未配置模型应使用默认定价", () => {
      const cost = calculateCost(100000, 50000, "unknown-model", testConfig);
      expect(cost).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/infra/token-quota.test.ts`
Expected: FAIL

**Step 3: Create token-quota.ts**

```typescript
// src/infra/token-quota.ts
import type { OpenClawConfig } from "../config/config.js";

export const USD_TO_CNY = 7.2;

export type QuotaUser = { limit: number; spent: number };

export function getUserQuota(userId: string, config: OpenClawConfig): QuotaUser | undefined {
  const quota = config.quota;
  if (!quota?.enabled) return undefined;
  const userQuota = quota.users?.[userId];
  if (!userQuota || userQuota.limit <= 0) return undefined;
  return userQuota;
}

export function checkQuota(userId: string, amount: number, config: OpenClawConfig): boolean {
  const quota = getUserQuota(userId, config);
  if (!quota) return true;
  return amount <= quota.limit - (quota.spent ?? 0);
}

export function getRemainingQuota(userId: string, config: OpenClawConfig): number | null {
  const quota = getUserQuota(userId, config);
  if (!quota) return null;
  return quota.limit - (quota.spent ?? 0);
}

export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  config: OpenClawConfig,
): number {
  const pricing = config.modelPricing?.[model];
  const defaultPrice = 0.5;
  const inputPrice = pricing?.input ?? defaultPrice;
  const outputPrice = pricing?.output ?? defaultPrice;

  const inputCostUSD = (inputTokens * inputPrice) / 1_000_000;
  const outputCostUSD = (outputTokens * outputPrice) / 1_000_000;

  return (inputCostUSD + outputCostUSD) * USD_TO_CNY;
}

export interface QuotaResult {
  success: boolean;
  remaining: number;
  error?: string;
}

export async function consumeQuota(userId: string, cost: number): Promise<QuotaResult> {
  // TODO: 实现配置文件更新
  return { success: true, remaining: 0 };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/infra/token-quota.test.ts`
Expected: PASS

**Step 5: Commit**

---

### Phase 3: Gateway API

#### Task 3.1: 创建配额 API Handler

**Files:**

- Create: `src/gateway/server-methods/quota.ts`
- Test: `src/gateway/server-methods/quota.test.ts` (新建)

**Step 1: Create quota handlers**

```typescript
// src/gateway/server-methods/quota.ts
import type { GatewayRequestHandlers } from "./types.js";
import { loadConfig } from "../../config/config.js";
import { getUserQuota, checkQuota, getRemainingQuota } from "../../infra/token-quota.js";

export const quotaHandlers: GatewayRequestHandlers = {
  "quota.status": async ({ respond, params }) => {
    const config = loadConfig();
    const userId = params?.userId as string | undefined;

    if (!userId) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "userId required" });
      return;
    }

    const quota = getUserQuota(userId, config);

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
    const userId = params?.userId as string | undefined;
    const amount = typeof params?.amount === "number" ? params.amount : 0;

    if (!userId) {
      respond(false, undefined, { code: "INVALID_REQUEST", message: "userId required" });
      return;
    }

    const allowed = checkQuota(userId, amount, config);
    const remaining = getRemainingQuota(userId, config);

    respond(true, { allowed, remaining: remaining ?? -1 }, undefined);
  },
};
```

**Step 2: Register in server-methods.ts**

在 `src/gateway/server-methods.ts` 中导入并注册 `quotaHandlers`

**Step 3: Build and verify**

Run: `pnpm build`
Expected: BUILD SUCCESS

**Step 4: Commit**

---

### Phase 4: 请求集成

#### Task 4.1: 在 Chat Handler 中集成配额检查

**Files:**

- Modify: `src/gateway/server-methods/chat.ts`

**Step 1: Find where to add check**

Run: `grep -n "handleChat\|async.*chat" src/gateway/server-methods/chat.ts | head -10`

**Step 2: Add quota check**

在处理请求前添加检查：

```typescript
import { checkQuota, getRemainingQuota } from "../../infra/token-quota.js";

// 在 chat handler 内
const userId = params?.userId as string | undefined;
const estimatedCost = 1.0; // 预估费用

if (userId && !checkQuota(userId, estimatedCost, config)) {
  const remaining = getRemainingQuota(userId, config);
  respond(false, undefined, {
    code: "QUOTA_EXCEEDED",
    message: `额度不足。剩余: ¥${remaining?.toFixed(2)}`,
  });
  return;
}
```

**Step 3: Build and verify**

Run: `pnpm build`
Expected: BUILD SUCCESS

**Step 4: Commit**

---

### Phase 5: 异步扣减

#### Task 5.1: 实现异步扣减逻辑

**Files:**

- Modify: `src/infra/token-quota.ts`

**Step 1: Add async consume with config update**

更新 `consumeQuota` 函数，实现配置文件更新：

```typescript
import { loadConfig, saveConfig } from "../config/config.js";

export async function consumeQuota(userId: string, cost: number): Promise<QuotaResult> {
  const config = loadConfig();
  const quota = getUserQuota(userId, config);

  if (!quota) {
    return { success: true, remaining: -1 };
  }

  const newSpent = (quota.spent ?? 0) + cost;
  const remaining = quota.limit - newSpent;

  // 异步更新配置文件
  queueMicrotask(async () => {
    try {
      if (!config.quota?.users?.[userId]) return;
      config.quota.users[userId].spent = newSpent;
      await saveConfig(config);
    } catch (e) {
      console.error("Failed to update quota:", e);
    }
  });

  return { success: true, remaining };
}
```

**Step 2: Add config save method (if not exists)**

检查 `src/config/config.ts` 是否有 `saveConfig` 方法，如果没有则需要实现

**Step 3: Commit**

---

### Phase 6: UI - 侧边栏

#### Task 6.1: 创建 SidebarQuotaBar 组件

**Files:**

- Create: `ui-agent/src/components/quota/SidebarQuotaBar.tsx`
- Modify: `ui-agent/src/components/sidebar/Sidebar.tsx`

**Step 1: Create component**

```typescript
// ui-agent/src/components/quota/SidebarQuotaBar.tsx
import { useEffect, useState } from "react";

type QuotaStatus = {
  enabled: boolean;
  unlimited?: boolean;
  limit?: number | null;
  spent?: number;
  remaining?: number | null;
  spentPercent?: number;
};

type UsageStatus = {
  totalTokens?: number;
  totalCost?: number;
};

export function SidebarQuotaBar() {
  const [quota, setQuota] = useState<QuotaStatus | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const quotaRes = await window.__gateway?.invoke("quota.status", { userId: "current" });
        if (quotaRes?.success) setQuota(quotaRes.data);

        const usageRes = await window.__gateway?.invoke("usage.cost", { days: 1 });
        if (usageRes?.success) {
          setUsage({
            totalTokens: usageRes.data?.totals?.totalTokens ?? 0,
            totalCost: usageRes.data?.totals?.totalCost ?? 0,
          });
        }
      } catch (e) {
        console.error("Failed to fetch quota/usage:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="text-xs text-text-tertiary px-md py-sm">Loading...</div>;

  const fmtToken = (n?: number) => (n && n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n ?? "0");
  const fmtMoney = (n?: number) => (n ? `¥${n.toFixed(2)}` : "¥0");

  return (
    <div className="px-md py-sm border-t border-border-light text-xs text-text-tertiary">
      <div className="flex justify-between">
        <span>Token: {fmtToken(usage?.totalTokens)}</span>
        <span>已用: {fmtMoney(usage?.totalCost)}</span>
      </div>
      {quota?.enabled && !quota?.unlimited && (
        <div className="mt-1">
          <div className="flex justify-between">
            <span>限额: {fmtMoney(quota.limit)}</span>
            <span>剩余: {fmtMoney(quota.remaining)}</span>
          </div>
          <div className="h-1.5 bg-border-light rounded-full overflow-hidden mt-1">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(quota.spentPercent ?? 0, 100)}%`,
                backgroundColor: (quota.spentPercent ?? 0) > 80 ? "#f59e0b" : "#22c55e",
              }}
            />
          </div>
        </div>
      )}
      {quota?.enabled && quota?.unlimited && <div className="mt-1">无限额</div>}
      {!quota?.enabled && <div className="mt-1">未设置配额</div>}
    </div>
  );
}
```

**Step 2: Add to Sidebar**

在 `ui-agent/src/components/sidebar/Sidebar.tsx` 中：

1. 导入：`import { SidebarQuotaBar } from "@/components/quota/SidebarQuotaBar";`
2. 在底部功能区前添加：`<SidebarQuotaBar />`

**Step 3: Commit**

---

### Phase 7: UI - 设置页面

#### Task 7.1: 创建 QuotaTab 组件

**Files:**

- Create: `ui-agent/src/components/settings/tabs/QuotaTab.tsx`
- Modify: `ui-agent/src/components/settings/SettingsPage.tsx`

**Step 1: Create QuotaTab component**

```typescript
// ui-agent/src/components/settings/tabs/QuotaTab.tsx
import { useEffect, useState } from "react";

type QuotaConfig = {
  enabled: boolean;
  modelPricing: Record<string, { input: number; output: number }>;
  users: Record<string, { limit: number; spent: number }>;
};

export function QuotaTab() {
, setConfig]  const [config = useState<QuotaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await window.__gateway?.invoke("quota.config.get");
        if (res?.success) setConfig(res.data);
      } catch (e) {
        console.error("Failed to load quota config:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    await window.__gateway?.invoke("quota.config.update", config);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config?.enabled ?? false}
          onChange={(e) => setConfig({ ...config!, enabled: e.target.checked })}
        />
        <label>启用配额</label>
      </div>

      <div>
        <h3>模型定价</h3>
        {/* 模型列表和编辑 */}
      </div>

      <div>
        <h3>用户配额</h3>
        {/* 用户列表和编辑 */}
      </div>

      <button onClick={handleSave}>保存</button>
    </div>
  );
}
```

**Step 2: Add to SettingsPage**

在 Settings 页面中添加 Quota Tab 入口

**Step 3: Commit**

---

## 执行选项

**Plan complete. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task

**2. Parallel Session (separate)** - Open new session with executing-plans

**Which approach?**
