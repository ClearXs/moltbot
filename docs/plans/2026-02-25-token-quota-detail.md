# Token 配额管理功能实现详细文档

## 功能概述

在侧边栏底部显示一行信息：

```
Token: 10K | 已用: ¥7.56 | 限额: ¥100 剩余: ¥50
```

---

## 一、配置文件 (src/config/zod-schema.ts)

### 新增配置项

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

## 二、后端模块 (src/infra/token-quota.ts)

### 功能

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

### 新增接口

#### 1. quota.status - 获取配额状态

请求:

```json
{
  "method": "quota.status",
  "params": { "userId": "alice" }
}
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

#### 2. quota.check - 检查配额是否足够

请求:

```json
{
  "method": "quota.check",
  "params": { "userId": "alice", "amount": 10 }
}
```

响应:

```json
{
  "success": true,
  "data": {
    "allowed": true,
    "remaining": 40
  }
}
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

## 五、UI 显示 (ui-agent)

### 组件: SidebarQuotaBar

位置: `ui-agent/src/components/quota/SidebarQuotaBar.tsx`

显示内容:

```
Token: 10K | 已用: ¥7.56 | 限额: ¥100 剩余: ¥50
```

### API 调用

```typescript
// 获取配额
const quotaRes = await gateway.invoke("quota.status", { userId: "current" });

// 获取今日费用
const usageRes = await gateway.invoke("usage.cost", { days: 1 });

// 渲染
// Token: {input + output}K | 已用: ¥{totalCost} | 限额: ¥{limit} 剩余: ¥{remaining}
```

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
  # 其他模型使用默认定价
```

---

## 八、用户识别

当前方案使用配置中的 `users` 字段来识别用户。

实际使用时，`userId` 可以是:

- Telegram username
- Discord user ID
- Session ID
- 或任何唯一标识

需要在 chat handler 中根据当前会话来源获取对应的 userId。

---

## 九、测试场景

1. **无限额用户** → 显示 "Token: 10K | 已用: ¥7.56"
2. **有限额用户** → 显示 "Token: 10K | 已用: ¥7.56 | 限额: ¥100 剩余: ¥50"
3. **额度不足** → 拒绝请求，返回 "额度不足，剩余 ¥5"
4. **新用户** → 初始 spent: 0

---

文档完毕，确认方案后可以开始实现。
