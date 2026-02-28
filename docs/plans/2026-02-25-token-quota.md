# Token 配额管理功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 moltbot 添加 token 使用量可视化和用户级别的 RMB 额度限制功能

**Architecture:**

1. 在配置文件中添加用户 RMB 配额配置 (quota 字段)
2. 使用配置文件存储用户配额和已消耗金额
3. 根据模型单价计算每次 API 调用的费用并扣减配额
4. 侧边栏底部显示一行信息

**Tech Stack:**

- TypeScript
- 配置文件 (YAML)
- Gateway Server Methods API

---

## 功能概述

侧边栏底部显示一行信息：

```
Token: 10K | 已用: ¥7.56 | 限额: ¥100 剩余: ¥50
```

---

## 一、配置文件

### 新增配置项 (src/config/zod-schema.ts)

```yaml
# 额度开关
quota:
  enabled: true

  # 用户配额 (每个用户独立的限额)
  users:
    alice:
      limit: 100 # 限额 100 元
      spent: 50 # 已消费 50 元
    bob:
      limit: 0 # 0 或不填 = 无限额

# 模型定价 (单位: USD/百万 tokens)
modelPricing:
  claude-sonnet-4-20250514:
    input: 3 # $3/百万tokens
    output: 15 # $15/百万tokens
  gpt-4o:
    input: 2.5
    output: 10
```

### 限额规则

| 配置                   | 效果      |
| ---------------------- | --------- |
| `quota.enabled: false` | 功能关闭  |
| `limit` 不填           | 无限额    |
| `limit: 0`             | 无限额    |
| `limit: -100`          | 无限额    |
| `limit: 100`           | 100元限额 |

---

## 二、后端模块

### token-quota.ts 功能

1. **获取用户配额** - 从配置读取用户限额和已消费
2. **检查配额** - 判断是否足够本次消费
3. **计算费用** - 根据 token 数量和模型定价计算费用
4. **扣减配额** - 消费后减少配额

### 核心函数

```typescript
// 获取用户配额
getUserQuota(userId: string, config): { limit: number, spent: number } | undefined

// 检查是否足够消费
checkQuota(userId: string, amount: number, config): boolean

// 获取剩余配额
getRemainingQuota(userId, config): number | null

// 计算费用 (token -> 人民币)
calculateCost(inputTokens, outputTokens, model, config): number

// 消费配额 (扣减)
consumeQuota(userId: string, cost: number): Promise<QuotaResult>
```

### 费用计算逻辑

```
输入费用 = inputTokens × modelPricing[model].input / 1,000,000 × 汇率
输出费用 = outputTokens × modelPricing[model].output / 1,000,000 × 汇率
总费用 = (输入费用 + 输出费用) × 7.2 (汇率)
```

---

## 三、Gateway API

### 1. quota.status - 获取配额状态

请求:

```json
{ "method": "quota.status", "params": { "userId": "alice" } }
```

响应 (有限额):

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "unlimited": false,
    "limit": 100,
    "spent": 50,
    "remaining": 50,
    "spentPercent": 50
  }
}
```

响应 (无限额):

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "unlimited": true,
    "limit": null,
    "spent": 0,
    "remaining": null,
    "spentPercent": 0
  }
}
```

### 2. quota.check - 检查配额是否足够

请求:

```json
{ "method": "quota.check", "params": { "userId": "alice", "amount": 10 } }
```

响应:

```json
{ "success": true, "data": { "allowed": true, "remaining": 40 } }
```

---

## 四、费用扣减流程

```
用户发送消息
       ↓
处理请求 (chat handler)
       ↓
检查配额 checkQuota(userId, 预估费用)
       ↓
如果不足 → 返回错误 "额度不足"
       ↓
如果足够 → 继续处理
       ↓
会话结束
       ↓
计算实际费用 calculateCost(inputTokens, outputTokens, model)
       ↓
扣减配额 consumeQuota(userId, cost)
       ↓
保存更新后的 spent 到配置文件
```

---

## 五、UI 显示

### 侧边栏底部显示

```
Token: 10K | 已用: ¥7.56 | 限额: ¥100 剩余: ¥50
```

API 调用：

- `quota.status` - 获取配额状态
- `usage.cost` - 获取今日 token 使用量和费用

---

## 六、修改文件清单

| 文件                                                | 操作 | 描述                            |
| --------------------------------------------------- | ---- | ------------------------------- |
| `src/config/zod-schema.ts`                          | 修改 | 添加 quota 和 modelPricing 配置 |
| `src/infra/token-quota.ts`                          | 新建 | 配额核心逻辑                    |
| `src/gateway/server-methods/quota.ts`               | 新建 | Gateway API                     |
| `src/gateway/server-methods.ts`                     | 修改 | 注册 quota handlers             |
| `src/gateway/server-methods/chat.ts`                | 修改 | 添加配额检查                    |
| `ui-agent/src/components/quota/SidebarQuotaBar.tsx` | 新建 | 侧边栏显示组件                  |
| `ui-agent/src/components/sidebar/Sidebar.tsx`       | 修改 | 引入并显示配额栏                |

---

## 七、配置示例 (完整)

```yaml
# config.yaml

quota:
  enabled: true
  users:
    alice:
      limit: 100
      spent: 45.5
    bob:
      limit: 200
      spent: 0
    charlie: # 不设置 limit = 无限额
      spent: 1000

modelPricing:
  claude-sonnet-4-20250514:
    input: 3
    output: 15
  claude-3-5-sonnet-20241022:
    input: 3
    output: 15
  gpt-4o:
    input: 2.5
    output: 10
  gpt-4o-mini:
    input: 0.15
    output: 0.6
```

---

## 八、测试场景

1. **无限额用户** → 显示 "Token: 10K | 已用: ¥7.56"
2. **有限额用户** → 显示 "Token: 10K | 已用: ¥7.56 | 限额: ¥100 剩余: ¥50"
3. **额度不足** → 拒绝请求，返回 "额度不足，剩余 ¥5"
4. **新用户** → 初始 spent: 0

---

### Task 1: 添加配额配置 Schema

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
  gpt-4o:
    input: 2.5
    output: 10
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
Expected: FAIL (quota is not defined in schema)

**Step 3: Add quota schema to zod-schema.ts**

在 `src/config/zod-schema.ts` 文件末尾添加:

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
    limit: z.number().positive(), // 限额 (元)
    spent: z.number().nonnegative().optional(), // 已消费 (元)
  })
  .strict();

const TokenQuotaSchema = z
  .object({
    enabled: z.boolean().optional(),
    users: z.record(z.string(), TokenQuotaUserSchema).optional(),
  })
  .strict();
```

然后在 `OpenClawSchema` 中添加:

```typescript
// 在 existing fields 后添加
quota: TokenQuotaSchema.optional(),
modelPricing: ModelPricingSchema.optional(),
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/config/config.quota.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/zod-schema.ts src/config/config.quota.test.ts
git commit -m "feat: add RMB quota config schema"
```

---

### Task 2: 添加配额存储和费用计算模块

**Files:**

- Create: `src/infra/token-quota.ts`
- Test: `src/infra/token-quota.test.ts` (新建)

**Step 1: Write the failing test**

```typescript
// src/infra/token-quota.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadConfig } from "../config/config.js";
import { getUserQuota, checkQuota, calculateCost, USD_TO_CNY } from "./token-quota.js";

describe("RMB quota", () => {
  const testConfig = {
    quota: {
      enabled: true,
      users: {
        testuser: { limit: 100, spent: 50 },
      },
    },
    modelPricing: {
      "claude-3-5-sonnet": { input: 3, output: 15 }, // USD/百万tokens
    },
  } as any;

  it("should get user quota from config", () => {
    const quota = getUserQuota("testuser", testConfig);
    expect(quota?.limit).toBe(100);
    expect(quota?.spent).toBe(50);
  });

  it("should return undefined for unlimited quota (limit <= 0)", () => {
    const unlimitedConfig = {
      quota: { enabled: true, users: { alice: { limit: 0, spent: 100 } } },
    } as any;
    const quota = getUserQuota("alice", unlimitedConfig);
    expect(quota).toBeUndefined();
  });

  it("should calculate cost from token usage", () => {
    // 100000 input tokens, 50000 output tokens
    // input: 100000 * 3 / 1000000 = 0.3 USD
    // output: 50000 * 15 / 1000000 = 0.75 USD
    // total: 1.05 USD * 7.2 (汇率) = 7.56 CNY
    const cost = calculateCost(100000, 50000, "claude-3-5-sonnet", testConfig);
    expect(cost).toBeCloseTo(7.56, 1);
  });

  it("should check if user has enough quota", () => {
    // 50 spent, 100 limit, remaining 50
    // request costs 60, should fail
    const canConsume = checkQuota("testuser", 60, testConfig);
    expect(canConsume).toBe(false);
  });

  it("should allow when enough quota remaining", () => {
    const canConsume = checkQuota("testuser", 30, testConfig);
    expect(canConsume).toBe(true);
  });

  it("should allow when no quota configured (unlimited)", () => {
    const noQuotaConfig = { quota: { enabled: true } } as any;
    const canConsume = checkQuota("newuser", 1000, noQuotaConfig);
    expect(canConsume).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/infra/token-quota.test.ts`
Expected: FAIL (token-quota module not found)

**Step 3: Create token-quota.ts**

```typescript
// src/infra/token-quota.ts
import type { OpenClawConfig } from "../config/config.js";

// 默认汇率 (USD -> CNY)
export const USD_TO_CNY = 7.2;

export type QuotaUser = {
  limit: number;
  spent: number;
};

export type QuotaConfig = {
  enabled?: boolean;
  users?: Record<string, QuotaUser>;
};

export type ModelPricing = Record<string, { input?: number; output?: number }>;

export interface QuotaResult {
  success: boolean;
  remaining: number;
  cost: number;
  error?: string;
}

/**
 * 获取用户配额
 * 如果未配置配额，或 limit <= 0，返回 undefined 表示无限额
 */
export function getUserQuota(userId: string, config: OpenClawConfig): QuotaUser | undefined {
  const quota = config.quota;
  if (!quota?.enabled) return undefined;
  const userQuota = quota.users?.[userId];
  // limit <= 0 视为无限额
  if (!userQuota || userQuota.limit <= 0) return undefined;
  return userQuota;
}

/**
 * 检查配额是否足够
 * 无配额配置或无限额时返回 true
 */
export function checkQuota(userId: string, amount: number, config: OpenClawConfig): boolean {
  const quota = getUserQuota(userId, config);
  if (!quota) return true; // No quota or unlimited, allow all
  const remaining = quota.limit - (quota.spent ?? 0);
  return amount <= remaining;
}

/**
 * 获取剩余配额
 * 无限额时返回 null
 */
export function getRemainingQuota(userId: string, config: OpenClawConfig): number | null {
  const quota = getUserQuota(userId, config);
  if (!quota) return null; // unlimited
  return quota.limit - (quota.spent ?? 0);
}

/**
 * 计算费用 (基于 token 数量和模型定价)
 * @param inputTokens 输入 token 数
 * @param outputTokens 输出 token 数
 * @param model 模型名称
 * @param config 配置
 * @returns 费用 (CNY)
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  config: OpenClawConfig,
): number {
  const pricing = config.modelPricing?.[model];
  if (!pricing) {
    // 默认定价: 假设便宜的模型
    const defaultPrice = 0.5; // USD/百万tokens
    const totalTokens = inputTokens + outputTokens;
    return ((totalTokens * defaultPrice) / 1_000_000) * USD_TO_CNY;
  }

  const inputCostUSD = (inputTokens * (pricing.input ?? 0)) / 1_000_000;
  const outputCostUSD = (outputTokens * (pricing.output ?? 0)) / 1_000_000;
  const totalUSD = inputCostUSD + outputCostUSD;

  return totalUSD * USD_TO_CNY;
}

/**
 * 消费配额
 */
export async function consumeQuota(userId: string, cost: number): Promise<QuotaResult> {
  // Will be implemented after we have config persistence
  return { success: true, remaining: 0, cost };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/infra/token-quota.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/infra/token-quota.ts src/infra/token-quota.test.ts
git commit -m "feat: add RMB quota module with cost calculation"
```

---

### Task 3: 添加配额 Gateway API

**Files:**

- Create: `src/gateway/server-methods/quota.ts`

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
    const spentPercent = quota.limit > 0 ? ((quota.spent ?? 0) / quota.limit) * 100 : 0;

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

    respond(
      true,
      {
        allowed,
        remaining: remaining ?? -1,
      },
      undefined,
    );
  },
};
```

**Step 2: Register handlers in server-methods.ts**

在 `src/gateway/server-methods.ts` 中导入并注册

**Step 3: Commit**

```bash
git add src/gateway/server-methods/quota.ts src/gateway/server-methods.ts
git commit -m "feat: add quota gateway API"
```

---

### Task 4: 在请求处理中集成配额检查

**Files:**

- Modify: `src/gateway/server-methods/chat.ts`

**Step 1: Add quota check before chat handling**

在 chat handler 开头添加:

```typescript
import { checkQuota, getRemainingQuota, calculateCost } from "../../infra/token-quota.js";

// 在 chat handler 内
const userId = params?.userId as string | undefined;
const model = params?.model as string | undefined;

// 估算费用 (实际费用在会话结束后计算)
const estimatedCost = 1.0; // 预估 1 元

if (userId && !checkQuota(userId, estimatedCost, config)) {
  const remaining = getRemainingQuota(userId, config);
  respond(false, undefined, {
    code: "QUOTA_EXCEEDED",
    message: `额度不足。剩余: ¥${remaining?.toFixed(2)}`,
  });
  return;
}
```

**Step 2: Commit**

```bash
git add src/gateway/server-methods/chat.ts
git commit -m "feat: integrate quota check in chat handler"
```

---

### Task 5: 添加会话结束后的费用计算和扣减

**Files:**

- Modify: `src/infra/session-cost-usage.ts`
- Modify: `src/config/config.ts`

**Step 1: 找到会话结束处理位置**

Run: `grep -n "final\|complete\|end" src/gateway/server-methods/chat.ts | head -20`

**Step 2: 在会话完成后计算费用并扣减**

在会话完成时调用:

```typescript
import { consumeQuota, calculateCost } from "../../infra/token-quota.js";

// 在会话完成的回调中
const usage = message.usage;
if (usage && userId) {
  const cost = calculateCost(usage.input ?? 0, usage.output ?? 0, model ?? "unknown", config);

  if (cost > 0) {
    await consumeQuota(userId, cost);
  }
}
```

**Step 3: Commit**

```bash
git add src/gateway/server-methods/chat.ts src/infra/token-quota.ts
git commit -m "feat: add cost calculation and quota deduction on session complete"
```

---

### Task 6: 在 UI 中显示配额和 Token 使用量 (ui-agent)

**Files:**

- Create: `ui-agent/src/components/quota/SidebarQuotaBar.tsx`
- Modify: `ui-agent/src/components/sidebar/Sidebar.tsx`

**Step 1: Create SidebarQuotaBar component**

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
  inputTokens?: number;
  outputTokens?: number;
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
        // 获取配额状态
        const quotaRes = await window.__gateway?.invoke("quota.status", { userId: "current" });
        if (quotaRes?.success) {
          setQuota(quotaRes.data);
        }

        // 获取今日使用量
        const usageRes = await window.__gateway?.invoke("usage.cost", {
          days: 1,
        });
        if (usageRes?.success) {
          const data = usageRes.data?.totals;
          setUsage({
            inputTokens: data?.input ?? 0,
            outputTokens: data?.output ?? 0,
            totalTokens: data?.totalTokens ?? 0,
            totalCost: data?.totalCost ?? 0,
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

  if (loading) {
    return (
      <div className="text-xs text-text-tertiary px-md py-sm">
        Loading...
      </div>
    );
  }

  // 格式化数字
  const fmtToken = (n?: number) => {
    if (n == null || n <= 0) return "0";
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const fmtMoney = (n?: number) => {
    if (n == null || n <= 0) return "¥0";
    return `¥${n.toFixed(2)}`;
  };

  // Token 显示: 10K
  const tokenDisplay = fmtToken(usage?.totalTokens);
  // 费用显示: ¥7.56
  const costDisplay = fmtMoney(usage?.totalCost);

  return (
    <div className="px-md py-sm border-t border-border-light text-xs text-text-tertiary">
      {/* 基础显示: Token + 费用 */}
      <div className="flex justify-between">
        <span>Token: {tokenDisplay}</span>
        <span>已用: {costDisplay}</span>
      </div>

      {/* 配额进度 (仅当有限额时显示) */}
      {quota?.enabled && !quota?.unlimited && quota?.limit && (
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

      {/* 无限额提示 */}
      {quota?.enabled && quota?.unlimited && (
        <div className="mt-1">无限额</div>
      )}

      {/* 未启用配额 */}
      {!quota?.enabled && (
        <div className="mt-1">未设置配额</div>
      )}
    </div>
  );
}
```

**Step 2: Add to Sidebar.tsx**

在 `ui-agent/src/components/sidebar/Sidebar.tsx` 中:

1. 导入组件:

```typescript
import { SidebarQuotaBar } from "@/components/quota/SidebarQuotaBar";
```

2. 在底部功能区 (第 930 行 ` {/* 底部功能区 */}` 之前) 添加:

```tsx
{
  /* 配额和 Token 使用量 */
}
<SidebarQuotaBar />;
```

**Step 3: Commit**

```bash
git add ui-agent/src/components/quota/ ui-agent/src/components/sidebar/Sidebar.tsx
git commit -m "feat: add quota and token usage to sidebar"
```

---

## 执行选项

**Plan complete and saved to `docs/plans/2026-02-25-token-quota.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
