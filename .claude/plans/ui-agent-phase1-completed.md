# UI-Agent Clawdbot Integration - 最小MVP实现方案

## 📋 项目概述

**目标**: 将 ui-agent (Manus风格的前端演示项目) 与 Clawdbot API 集成,实现一个功能完整的最小MVP版本

**当前状态**:

- ✅ ui-agent: 基于 Next.js 14 + TypeScript + Zustand 的纯前端项目
- ✅ Clawdbot API: 提供 WebSocket Gateway + HTTP REST API
- ❌ 无任何后端集成,使用静态演示数据

## 🎯 最小MVP功能范围

基于用户需求和Moltbot已有能力,MVP将包含以下完整功能:

### 核心功能 (全部必须实现)

1. **WebSocket连接管理**
   - 建立ws://localhost:18789连接
   - 处理连接握手 (connect.challenge → connect → hello-ok)
   - 自动重连机制 (指数退避策略)
   - 连接状态实时显示

2. **实时对话功能**
   - 发送消息到Agent (`agent` 方法)
   - 接收流式回复 (`agent.message` 事件)
   - 消息历史显示 (复用现有 MessageList/MessageBubble 组件)
   - 对话中断 (`chat.abort`)
   - 幂等性密钥生成 (UUID v4)

3. **完整多模态支持** ⭐
   - **图片上传**: 拖拽、粘贴、文件选择
   - **文件附件**: 支持PDF、Word、文本等
   - **Base64编码**: 自动转换为API所需格式
   - **图片预览**: 上传前预览,上传后显示
   - **Agent输出图片**: 解析并显示Agent返回的图片

4. **会话管理**
   - 会话列表显示 (`sessions.list`)
   - 创建新会话 (使用不同sessionKey)
   - 删除会话 (`sessions.delete`)
   - 重置会话 (`sessions.reset`)
   - 会话Token统计
   - 会话切换和历史加载

5. **完整Agent执行面板** ⭐
   - 显示所有执行步骤详情
   - 工具调用列表 (包括memory_search、bash、read等)
   - 执行日志 (所有level: info/debug/error)
   - 创建文件列表
   - Human-in-the-loop确认
   - 执行进度追踪

6. **记忆系统可视化** ⭐
   - 在ToolCallList中显示memory_search工具调用
   - 显示搜索query和检索结果
   - 显示相关性评分和匹配片段
   - 记忆来源文件路径展示

### 延后功能 (MVP后实现)

- ❌ 多Agent切换 (MVP仅使用main agent)
- ❌ 会话压缩UI (API已支持,暂不暴露UI)
- ❌ 高级配置面板 (思考级别/超时/自定义提示词使用默认值)
- ❌ 会话导出/导入
- ❌ 语音输入/输出

## 🏗️ 技术实现方案

### 1. WebSocket服务层

**新建文件**: `src/services/clawdbot-websocket.ts`

```typescript
// WebSocket连接管理器
class ClawdbotWebSocketClient {
  - connect(): Promise<void>
  - disconnect(): void
  - sendRequest<T>(method, params): Promise<T>
  - addEventListener(event, handler): void
  - removeEventListener(event, handler): void
}
```

**核心方法**:

- `connect()` - 握手流程 (nonce → token → hello-ok)
- `agent()` - 发送消息
- `chat.history()` - 获取历史
- `chat.abort()` - 中断对话
- `sessions.list/delete/reset()` - 会话管理

### 2. 状态管理更新

**更新文件**:

- `src/stores/chatStore.ts` - 集成真实API调用
- `src/stores/agentStore.ts` - 处理Agent事件流
- 新增 `src/stores/connectionStore.ts` - WebSocket连接状态

**chatStore变更**:

```typescript
interface ChatStore {
  // 现有状态保留
  chats: Chat[];
  activeChat: string | null;

  // 新增方法
  sendMessage: (chatId: string, content: string) => Promise<void>;
  loadHistory: (sessionKey: string) => Promise<void>;
  abortChat: (sessionKey: string) => Promise<void>;
}
```

**connectionStore (新)**:

```typescript
interface ConnectionStore {
  status: "disconnected" | "connecting" | "connected" | "error";
  wsClient: ClawdbotWebSocketClient | null;
  lastError: string | null;

  connect: () => Promise<void>;
  disconnect: () => void;
}
```

### 3. 自定义Hooks更新

**更新**: `src/hooks/useChat.ts`

```typescript
// 从静态数据切换到真实WebSocket调用
export function useChat(sessionKey: string) {
  const wsClient = useConnectionStore((s) => s.wsClient);

  const sendMessage = async (content: string) => {
    if (!wsClient) throw new Error("Not connected");

    const runId = await wsClient.sendRequest("agent", {
      message: content,
      sessionKey,
      idempotencyKey: generateIdempotencyKey(),
    });

    // 等待agent.message事件...
  };

  return { sendMessage, loading, error };
}
```

**更新**: `src/hooks/useAgent.ts`

```typescript
// 监听agent.message事件,更新agentStore
export function useAgent() {
  useEffect(() => {
    wsClient?.addEventListener("agent.message", handleAgentMessage);
    // ...
  }, [wsClient]);
}
```

### 4. UI组件适配

**无需修改** (已有组件可直接使用):

- ✅ `MessageList` / `MessageBubble` - 显示对话
- ✅ `AgentPanel` - Agent执行面板
- ✅ `TodoList` - 任务列表
- ✅ `ToolCallList` - 工具调用
- ✅ `EnhancedChatInput` - 消息输入
- ✅ `Sidebar` - 会话列表

**需调整**:

- `TopBar.tsx` - 添加连接状态指示器
- `ConversationList.tsx` - 从API加载会话列表
- `WelcomePage.tsx` - 移除演示数据,显示真实会话

### 5. 环境配置

**新建**: `.env.local` (ui-agent目录)

```bash
# Clawdbot Gateway连接配置
NEXT_PUBLIC_WS_URL=ws://localhost:18789
NEXT_PUBLIC_GATEWAY_TOKEN=  # 可选,如果Gateway配置了CLAWDBOT_GATEWAY_TOKEN环境变量

# 客户端标识 (可选自定义)
NEXT_PUBLIC_CLIENT_ID=ui-agent-web
NEXT_PUBLIC_CLIENT_VERSION=1.0.0
```

**更新**: `package.json` (可能需要添加依赖)

```json
{
  "dependencies": {
    // 如果需要更好的WebSocket支持:
    // "reconnecting-websocket": "^4.4.0",
    // 如果需要文件类型检测:
    // "file-type": "^18.0.0",
    // 现有依赖已足够,暂不添加新依赖
  }
}
```

## 📂 关键文件清单

### 新建文件 (约15个)

**核心服务**:

1. `src/services/clawdbot-websocket.ts` - WebSocket客户端核心
2. `src/services/websocket-protocol.ts` - 协议层封装

**状态管理**: 3. `src/stores/connectionStore.ts` - 连接状态管理

**类型定义**: 4. `src/types/clawdbot.ts` - Clawdbot API完整类型5. `src/types/websocket.ts` - WebSocket消息类型6. `src/types/multimodal.ts` - 多模态相关类型

**工具函数**: 7. `src/utils/idempotency.ts` - 幂等性密钥生成 8. `src/utils/file-encoding.ts` - 文件Base64编码9. `src/utils/mime-detection.ts` - MIME类型检测

**多模态组件**: 10. `src/components/multimodal/FileUploadArea.tsx` - 文件上传区域 11. `src/components/multimodal/ImagePreview.tsx` - 图片预览 12. `src/components/multimodal/AttachmentList.tsx` - 附件列表 13. `src/components/multimodal/ImageOutput.tsx` - Agent输出图片显示

**记忆可视化组件**: 14. `src/components/agent/MemorySearchResultCard.tsx` - 记忆检索结果卡片 15. `src/components/agent/MemorySearchBadge.tsx` - 记忆检索标识

### 修改文件 (约12个)

**状态管理**:

1. `src/stores/chatStore.ts` - 集成真实WebSocket API
2. `src/stores/agentStore.ts` - Agent事件处理增强

**Hooks**: 3. `src/hooks/useChat.ts` - WebSocket消息发送4. `src/hooks/useAgent.ts` - Agent事件监听和解析5. `src/hooks/useWebSocket.ts` - WebSocket连接管理 (新增)

**布局和导航**: 6. `src/components/layout/TopBar.tsx` - 添加连接状态指示器 7. `src/components/sidebar/ConversationList.tsx` - sessions.list API集成8. `src/components/sidebar/Sidebar.tsx` - 会话操作按钮 (删除/重置)

**对话组件**: 9. `src/components/chat/EnhancedChatInput.tsx` - 集成文件上传 10. `src/components/chat/MessageBubble.tsx` - 支持多模态内容显示

**Agent面板**: 11. `src/components/agent/ToolCallList.tsx` - 支持memory_search显示12. `src/components/agent/AgentPanel.tsx` - 完整事件流处理

**主页面**: 13. `src/app/page.tsx` - 移除所有演示数据,连接真实API

### 删除文件 (可选)

- `src/app/page.tsx` 中的演示数据相关常量 (内联删除即可)

## 🔄 数据流设计

```
用户输入消息
    ↓
EnhancedChatInput.onSubmit()
    ↓
chatStore.sendMessage()
    ↓
wsClient.sendRequest('agent', {...})
    ↓
WebSocket → Clawdbot Gateway
    ↓
← agent.message 事件
    ↓
agentStore.updateAgentData()
    ↓
UI自动更新 (Zustand响应式)
```

## ✅ 端到端验证计划

### 验证环境准备

**前置条件**:

1. ✅ Clawdbot Gateway运行在 `localhost:18789`
2. ✅ Gateway已配置至少一个AI provider (如Anthropic)
3. ✅ 记忆系统已启用 (可选,用于测试memory_search)

**启动步骤**:

```bash
# 1. 确认Gateway运行
curl http://localhost:18789/health  # 或检查Gateway进程

# 2. 启动ui-agent
cd ui-agent
npm install
npm run dev  # 访问 http://localhost:3002
```

### Phase 1 验证: 基础连接

**测试步骤**:

1. 打开浏览器访问 `http://localhost:3002`
2. 检查TopBar右上角连接状态指示器
3. 预期: 🟢 绿色圆点 + "已连接"文本

**调试**:

- 打开浏览器DevTools → Network → WS
- 检查WebSocket连接是否建立
- 查看握手消息:
  - `connect.challenge` (服务器→客户端)
  - `connect` (客户端→服务器)
  - `hello-ok` (服务器→客户端)

**失败排查**:

- ❌ 连接失败 → 检查Gateway是否运行
- ❌ 认证失败 → 检查GATEWAY_TOKEN配置
- ❌ 协议不匹配 → 确认Gateway版本 >= 2026.1.x

---

### Phase 2 验证: 核心对话

**测试用例 1: 基础对话**

```
输入: 你好
预期: Agent回复问候语,消息显示在对话区域
验证: Token统计更新 (inputTokens, outputTokens)
```

**测试用例 2: 对话历史**

```
操作: 刷新页面或切换会话后返回
预期: 之前的对话历史正确加载
验证: 消息顺序正确,时间戳显示
```

**测试用例 3: 中断对话**

```
输入: 帮我写一篇1000字的文章 (长响应)
操作: 点击"停止"按钮
预期: Agent停止生成,显示"已中断"提示
验证: runId状态标记为aborted
```

**调试**:

- DevTools Console查看错误日志
- Network → WS查看消息帧:
  - `agent` 请求
  - `agent.message` 事件

---

### Phase 3 验证: 多模态支持

**测试用例 4: 图片上传**

```
操作: 拖拽一张图片到输入框
预期: 显示图片预览缩略图
输入: 这张图片是什么?
预期: Agent分析图片并回复
验证: 附件正确编码为Base64,mimeType正确
```

**测试用例 5: 剪贴板粘贴**

```
操作: 复制图片,粘贴到输入框 (Ctrl/Cmd+V)
预期: 图片自动添加到附件列表
验证: 图片内容完整,可预览
```

**测试用例 6: 文件附件**

```
操作: 上传PDF文件
输入: 总结这个PDF的内容
预期: Agent读取PDF并生成摘要
验证: 文件大小显示,mimeType为application/pdf
```

**测试用例 7: Agent输出图片**

```
输入: 生成一个流程图 (如果Agent支持)
预期: 回复中的图片正确显示
验证: 图片可点击放大,可下载
```

**调试**:

- Console查看Base64编码长度
- 检查mimeType是否匹配文件类型
- Network查看上传的attachments字段

---

### Phase 4 验证: 会话管理

**测试用例 8: 创建新会话**

```
操作: 点击"新建会话"按钮
预期: 会话列表新增一个会话
验证: sessionKey唯一,会话为空白
```

**测试用例 9: 切换会话**

```
操作: 在会话A发送消息,切换到会话B,再切回A
预期: 会话A的消息完整保留
验证: 每个会话独立隔离
```

**测试用例 10: 删除会话**

```
操作: 右键会话 → 删除
预期: 会话从列表移除,文件系统删除session文件
验证: sessions.list不再返回该会话
```

**测试用例 11: 重置会话**

```
操作: 右键会话 → 重置
预期: 会话历史清空,但会话仍存在
验证: Token计数归零
```

**测试用例 12: Token统计**

```
操作: 发送多条消息
预期: 每条消息后Token计数累加
验证: totalTokens = inputTokens + outputTokens
```

**调试**:

- 检查`~/.clawdbot/sessions/`目录下的session文件
- DevTools查看sessions.list返回的数据

---

### Phase 5 验证: Agent面板 + 记忆

**测试用例 13: 工具调用显示**

```
输入: 帮我读取package.json文件
预期: AgentPanel显示:
  - StepItem: 执行步骤
  - ToolCallList: read工具调用
  - ExecutionLog: 文件读取日志
验证: 工具参数和结果正确显示
```

**测试用例 14: 记忆检索可视化**

```
前置: 在会话中讨论"虚拟形象项目需求"
输入: 回忆一下我们讨论的虚拟形象项目
预期: ToolCallList显示memory_search调用
  - 显示query: "虚拟形象项目"
  - 显示检索结果 (路径、得分、片段)
  - MemorySearchResultCard展示记忆卡片
验证: 相关性得分正确,文本片段高亮
```

**测试用例 15: 执行步骤追踪**

```
输入: 帮我创建一个README.md文件,内容是项目介绍
预期: AgentPanel显示:
  1. 思考步骤 (planning)
  2. write工具调用
  3. 文件创建确认
  - CreatedFiles列表显示README.md
验证: 每个步骤状态正确 (pending → running → completed)
```

**测试用例 16: Human-in-the-loop**

```
输入: 帮我删除所有日志文件 (危险操作)
预期: 弹出HumanConfirmationCard
  - 显示待执行的命令
  - 提供"批准" / "拒绝"按钮
操作: 点击"拒绝"
预期: 命令不执行,Agent停止
验证: 状态标记为user_cancelled
```

**调试**:

- Console查看tool_use和tool_result事件
- 检查agentStore中的executions数据结构

---

### Phase 6 验证: 错误处理与性能

**测试用例 17: 网络断开恢复**

```
操作: 停止Gateway进程
预期: 连接状态变为🔴 "连接断开"
操作: 重启Gateway
预期: 自动重连成功,状态变为🟢 "已连接"
验证: 重连后可正常发送消息
```

**测试用例 18: 发送失败重试**

```
操作: 断网,发送消息
预期: 消息显示"发送失败",出现重试按钮
操作: 恢复网络,点击重试
预期: 消息成功发送
```

**测试用例 19: 大文件上传**

```
操作: 尝试上传>10MB的文件
预期: 显示"文件过大"提示
建议: 限制文件大小在10MB以内
```

**测试用例 20: 性能测试**

```
操作: 创建包含100+条消息的会话
预期: 滚动流畅,无明显卡顿
验证: 使用React DevTools Profiler检查渲染性能
```

**测试用例 21: 并发操作**

```
操作: 快速切换会话并发送消息
预期: 每个会话的消息正确路由
验证: 无消息串话,sessionKey隔离正确
```

**调试**:

- Performance标签检查渲染瓶颈
- Memory标签检查内存泄漏
- Console查看错误日志和警告

---

### 回归测试清单

在完成所有Phase后,执行完整回归测试:

- [ ] **连接**: 能连接到Gateway,状态显示正确
- [ ] **对话**: 发送消息,接收回复,历史加载
- [ ] **多模态**: 图片/文件上传,Agent输出图片显示
- [ ] **会话**: 创建/删除/重置/切换会话
- [ ] **Agent**: 工具调用、记忆检索、执行步骤显示
- [ ] **错误**: 断网重连,失败重试,错误提示
- [ ] **性能**: 大列表流畅,无内存泄漏
- [ ] **UI**: 响应式布局,主题切换,动画流畅

### 验收标准

**功能完整性**:

- ✅ 所有21个测试用例通过
- ✅ 无阻塞性Bug
- ✅ 核心功能稳定运行

**性能指标**:

- ✅ 首屏加载 < 2秒
- ✅ 消息发送响应 < 500ms
- ✅ 会话切换 < 300ms
- ✅ 100条消息列表滚动FPS > 50

**代码质量**:

- ✅ TypeScript类型完整,无any滥用
- ✅ 无ESLint错误
- ✅ 关键函数有注释
- ✅ 代码可读性良好

---

### 端到端测试步骤

1. **连接测试**
   - 启动Clawdbot Gateway (端口18789)
   - 启动ui-agent (`npm run dev`)
   - 检查TopBar显示"已连接"状态

2. **对话测试**
   - 发送消息"你好"
   - 验证消息显示在MessageList
   - 验证Agent回复实时显示
   - 检查Token统计更新

3. **会话管理测试**
   - 创建新会话
   - 切换会话,验证历史加载
   - 删除会话,验证从列表移除
   - 重置会话,验证历史清空

4. **Agent执行测试**
   - 发送需要工具调用的消息
   - 验证AgentPanel显示执行步骤
   - 验证ToolCallList显示工具调用
   - 验证ExecutionLog显示日志

5. **错误处理测试**
   - 断开Gateway,验证重连逻辑
   - 发送无效消息,验证错误提示
   - 中断对话,验证abort功能

## 🚀 实现优先级

采用**分阶段开发,每阶段验证**的策略:

### Phase 1: 基础连接层 (1-2小时) ✅ 交付验证

- [ ] `ClawdbotWebSocketClient` 基础类实现
- [ ] WebSocket连接握手流程 (challenge → connect → hello-ok)
- [ ] `connectionStore` 状态管理 (Zustand)
- [ ] 自动重连机制 (指数退避)
- [ ] `TopBar` 连接状态UI指示器
- [ ] 环境变量配置 (.env.local)

**验证点**: 打开应用能看到"已连接"状态

---

### Phase 2: 核心对话功能 (2-3小时) ✅ 交付验证

- [ ] `agent` 方法集成
- [ ] `agent.message` 事件监听和处理
- [ ] `chatStore` API调用集成
- [ ] 幂等性密钥生成 (utils/idempotency.ts)
- [ ] `MessageList` 实时更新
- [ ] `chat.history` 历史加载
- [ ] `chat.abort` 中断对话

**验证点**: 可以发送消息"你好"并收到Agent回复

---

### Phase 3: 完整多模态支持 (2-3小时) ⭐ 交付验证

- [ ] 文件上传UI组件 (FileUploadArea)
- [ ] 拖拽上传功能 (drag & drop)
- [ ] 剪贴板粘贴图片 (clipboard paste)
- [ ] 文件 → Base64 转换工具
- [ ] `EnhancedChatInput` 附件管理
- [ ] 图片预览组件 (ImagePreview)
- [ ] Agent返回图片解析和显示
- [ ] 附件类型检测 (MIME type)

**验证点**: 可以上传图片并发送,Agent返回的图片能正常显示

---

### Phase 4: 会话管理 (1-2小时) ✅ 交付验证

- [ ] `sessions.list` 接口集成
- [ ] `ConversationList` API数据加载
- [ ] 创建新会话功能
- [ ] 删除会话 (`sessions.delete`)
- [ ] 重置会话 (`sessions.reset`)
- [ ] 会话切换逻辑
- [ ] Token统计显示
- [ ] 移除所有演示数据

**验证点**: 可以创建、切换、删除会话,Token统计准确

---

### Phase 5: Agent面板 + 记忆可视化 (2-3小时) ⭐ 交付验证

- [ ] Agent事件流解析 (所有tool_use/tool_result)
- [ ] `AgentPanel` 数据绑定
- [ ] `StepItem` 执行步骤显示
- [ ] `ToolCallList` 工具调用展示
- [ ] `ExecutionLog` 日志显示 (支持所有level)
- [ ] `CreatedFiles` 文件创建列表
- [ ] **记忆检索可视化**:
  - [ ] 识别memory_search工具调用
  - [ ] 显示搜索query
  - [ ] 显示检索结果 (路径、得分、片段)
  - [ ] MemorySearchResultCard 组件
- [ ] Human-in-the-loop确认UI
- [ ] 执行进度追踪

**验证点**: 发送"回忆一下我们之前讨论的项目",可以在面板看到memory_search调用和结果

---

### Phase 6: 测试与优化 (1-2小时) ✅ 最终交付

- [ ] 端到端测试 (所有功能路径)
- [ ] 错误处理完善
  - [ ] 网络断开恢复
  - [ ] API错误提示
  - [ ] 文件上传失败处理
- [ ] 性能优化
  - [ ] 大消息列表虚拟滚动
  - [ ] 图片懒加载
  - [ ] WebSocket消息节流
- [ ] UI/UX细节调整
  - [ ] Loading状态完善
  - [ ] 空状态提示
  - [ ] 响应式布局验证
- [ ] 文档更新 (README + 环境配置说明)

**验证点**: 所有功能稳定运行,无明显性能问题

---

**预估总工时**: 9-15小时 (比原计划增加了多模态和记忆可视化)

## 🎨 UI/UX考虑

- 保持现有Manus风格设计
- 添加连接状态指示器 (顶部栏)
- 消息发送中显示loading状态
- Agent执行时显示进度动画
- 网络错误友好提示
- 会话加载skeleton屏幕

## 🔧 核心技术实现要点

### 1. WebSocket协议实现

**握手流程** (参考API文档第84-165行):

```typescript
// 1. 服务器发送 connect.challenge
← { type: "event", event: "connect.challenge", payload: { nonce, ts } }

// 2. 客户端发送 connect 请求
→ {
  type: "req",
  id: "connect-001",
  method: "connect",
  params: {
    minProtocol: 3,
    maxProtocol: 3,
    client: { id, version, platform: "web", mode: "operator" },
    role: "operator",
    scopes: ["operator.read", "operator.write"],
    locale: "zh-CN"
  }
}

// 3. 服务器响应 hello-ok
← { type: "res", id: "connect-001", ok: true, payload: { type: "hello-ok", protocol: 3 } }
```

**消息帧格式**:

- **Request**: `{ type: "req", id, method, params }`
- **Response**: `{ type: "res", id, ok, payload?, error? }`
- **Event**: `{ type: "event", event, payload, seq?, stateVersion? }`

**自动重连策略**:

```typescript
// 指数退避算法
const reconnectDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
// attempt 0: 1s
// attempt 1: 2s
// attempt 2: 4s
// attempt 3: 8s
// ...
// max: 30s
```

### 2. 多模态数据编码

**文件 → Base64**:

```typescript
// FileReader API
const reader = new FileReader();
reader.onload = (e) => {
  const base64 = e.target.result.split(",")[1]; // 移除data:mime;base64,前缀
  // 发送到API
};
reader.readAsDataURL(file);
```

**附件格式** (API文档第260-268行):

```typescript
interface Attachment {
  type: "image" | "file";
  mimeType: string; // 如: image/png, application/pdf
  fileName?: string; // 文件名
  content: string; // Base64编码的内容
}
```

**MIME类型检测**:

```typescript
// 从文件扩展名推断
const mimeTypes = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};
```

### 3. Agent事件流解析

**核心事件类型**:

```typescript
// agent.message - Agent回复
{
  type: "event",
  event: "agent.message",
  payload: {
    sessionKey: string,
    message: string,        // Agent回复内容
    runId: string,
    status: "completed" | "error",
    model: string,
    usage: { inputTokens, outputTokens, totalTokens }
  }
}

// tool_use - 工具调用
{
  type: "content_block",
  content_block: {
    type: "tool_use",
    id: string,
    name: string,           // 如: memory_search, bash, read
    input: object           // 工具参数
  }
}

// tool_result - 工具结果
{
  type: "content_block",
  content_block: {
    type: "tool_result",
    tool_use_id: string,
    content: string         // 工具执行结果
  }
}
```

**Memory Search解析示例**:

```typescript
// tool_use事件
{
  name: "memory_search",
  input: {
    query: "虚拟形象项目",
    maxResults: 10
  }
}

// tool_result事件
{
  content: JSON.stringify([
    {
      path: "docs/avatar-requirements.md",
      lines: "15-30",
      score: 0.85,
      text: "虚拟形象需要支持...",
      vectorScore: 0.82,
      textScore: 0.88
    }
  ])
}
```

### 4. 幂等性密钥生成

**UUID v4实现**:

```typescript
// 使用crypto.randomUUID (现代浏览器)
const idempotencyKey = crypto.randomUUID();

// 或自定义格式
const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
```

### 5. 状态管理设计

**connectionStore**:

```typescript
interface ConnectionStore {
  status: "disconnected" | "connecting" | "connected" | "error";
  wsClient: ClawdbotWebSocketClient | null;
  lastError: string | null;
  reconnectAttempts: number;

  connect: () => Promise<void>;
  disconnect: () => void;
  reset: () => void;
}
```

**chatStore增强**:

```typescript
interface ChatStore {
  // 现有状态
  chats: Map<string, Chat>; // sessionKey → Chat
  activeSessionKey: string | null;

  // 新增方法
  sendMessage: (sessionKey: string, content: string, attachments?: Attachment[]) => Promise<string>;
  loadHistory: (sessionKey: string) => Promise<void>;
  abortChat: (sessionKey: string) => Promise<void>;
  addMessageFromEvent: (sessionKey: string, message: Message) => void;
}
```

**agentStore增强**:

```typescript
interface AgentStore {
  // 按runId存储Agent执行状态
  executions: Map<string, AgentExecution>;

  // 方法
  createExecution: (runId: string) => void;
  addToolCall: (runId: string, toolCall: ToolCall) => void;
  addToolResult: (runId: string, toolResult: ToolResult) => void;
  addStep: (runId: string, step: AgentStep) => void;
  updateStatus: (runId: string, status: ExecutionStatus) => void;
}
```

### 6. 错误处理策略

**WebSocket错误**:

- 连接失败 → 自动重连 (指数退避)
- 认证失败 → 提示用户检查token
- 协议版本不匹配 → 提示升级客户端

**API错误**:

- 超时 → 显示超时提示,允许重试
- 网络错误 → 显示离线提示,自动重连
- 业务错误 → 解析error字段,显示具体错误信息

**文件上传错误**:

- 文件过大 → 提示文件大小限制 (建议<10MB)
- 格式不支持 → 显示支持的文件类型列表
- 编码失败 → 提示文件可能已损坏

### 7. 性能优化考虑

**大消息列表**:

- 使用react-window或react-virtualized虚拟滚动
- 单次仅渲染可见区域的消息

**图片处理**:

- 图片懒加载 (IntersectionObserver)
- 压缩大图片后上传 (可选,但建议在服务端处理)
- 预览缩略图使用较小尺寸

**WebSocket消息**:

- 避免频繁状态更新 (使用debounce/throttle)
- 批量处理事件 (requestAnimationFrame)

### 8. UI/UX细节

**连接状态指示器**:

- 🔴 Disconnected - 红色圆点
- 🟡 Connecting - 黄色圆点 + 旋转动画
- 🟢 Connected - 绿色圆点
- ⚠️ Error - 橙色圆点 + 错误信息tooltip

**消息发送状态**:

- ⏳ Sending - 消息气泡半透明 + loading动画
- ✅ Sent - 正常显示
- ❌ Failed - 红色边框 + 重试按钮

**Agent执行状态**:

- 🤔 Thinking - ThinkingIndicator动画
- 🔧 Using Tools - 工具图标 + 进度条
- ✅ Completed - 绿色勾选
- ❌ Error - 红色错误提示

**文件上传交互**:

- 拖拽区域虚线边框 + "拖拽文件到这里"提示
- 拖拽悬停时高亮边框
- 上传进度条 (如果文件较大)
- 预览缩略图 + 删除按钮

---

| 决策点   | 选择               | 理由                      |
| -------- | ------------------ | ------------------------- |
| API协议  | WebSocket (非HTTP) | 实时双向通信,支持事件推送 |
| 状态管理 | Zustand (保持现有) | 轻量,已集成               |
| 类型安全 | 定义完整TS类型     | 基于API文档生成类型       |
| 错误处理 | 指数退避重连       | 网络波动容忍              |
| 幂等性   | UUID v4            | 避免重复请求              |
| 演示数据 | 完全移除           | MVP使用真实API            |

## 📝 最终总结

### 项目成果

通过本次集成,ui-agent将从**纯演示项目**升级为**功能完整的Clawdbot前端客户端**:

**核心价值**:

1. ✅ **实时AI对话** - WebSocket双向通信,低延迟响应
2. ✅ **多模态交互** - 支持图片、文件上传和输出
3. ✅ **完整Agent可视化** - 执行步骤、工具调用、记忆检索全流程展示
4. ✅ **专业会话管理** - 多会话隔离,Token统计,历史持久化
5. ✅ **生产级质量** - 错误处理完善,自动重连,性能优化

### 技术亮点

**架构设计**:

- WebSocket协议层封装,易扩展
- Zustand状态管理,响应式UI
- TypeScript类型安全,减少运行时错误
- 组件化设计,高复用性

**用户体验**:

- 拖拽/粘贴上传,交互便捷
- 实时连接状态,透明反馈
- 完整Agent执行可视化,可观测性强
- 流畅动画,专业UI设计

**工程质量**:

- 分阶段开发,风险可控
- 完整测试覆盖,质量保证
- 详细文档,易维护
- 性能优化,用户体验好

### 后续扩展方向

**短期** (1-2周):

- [ ] 语音输入/输出集成
- [ ] 会话导出/导入 (JSON/Markdown格式)
- [ ] 高级配置面板 (思考级别、超时、自定义提示词)
- [ ] 多Agent切换 (translator、summarizer等)

**中期** (1-2月):

- [ ] 移动端适配 (响应式优化)
- [ ] 桌面应用打包 (Electron/Tauri)
- [ ] 协作功能 (多用户会话共享)
- [ ] 插件系统 (自定义工具集成)

**长期** (3-6月):

- [ ] 本地模型支持 (Ollama集成)
- [ ] 知识库可视化管理
- [ ] Agent workflow编排器
- [ ] 数据分析与洞察面板

### 预期时间线

| 阶段     | 时间      | 交付物                       |
| -------- | --------- | ---------------------------- |
| Phase 1  | 1-2h      | WebSocket连接层 + 连接状态UI |
| Phase 2  | 2-3h      | 核心对话功能 + 历史加载      |
| Phase 3  | 2-3h      | 完整多模态支持               |
| Phase 4  | 1-2h      | 会话管理功能                 |
| Phase 5  | 2-3h      | Agent面板 + 记忆可视化       |
| Phase 6  | 1-2h      | 测试优化 + 文档              |
| **总计** | **9-15h** | **功能完整的MVP**            |

### 风险与应对

**技术风险**:

- ⚠️ WebSocket协议复杂 → 参考API文档,逐步实现
- ⚠️ 多模态编码问题 → 使用标准FileReader API
- ⚠️ 事件流解析复杂 → 设计清晰的类型定义

**进度风险**:

- ⚠️ 功能范围膨胀 → 严格遵循MVP范围,延后非核心功能
- ⚠️ 调试时间过长 → 分阶段验证,及时发现问题

**质量风险**:

- ⚠️ 性能问题 → 虚拟滚动、懒加载等优化手段
- ⚠️ 兼容性问题 → 测试主流浏览器 (Chrome, Firefox, Safari)

### 成功标准

**功能完整性**: ✅ 所有MVP功能实现,测试用例通过
**代码质量**: ✅ TypeScript类型完整,无严重Bug
**用户体验**: ✅ 流畅交互,响应及时,错误提示友好
**可维护性**: ✅ 代码结构清晰,文档完整,易扩展

---

## 🚀 准备开始实施

**当前状态**: ✅ 方案已完成,等待审核
**下一步**: 用户审核通过后,开始Phase 1开发
**预计完成**: 分阶段交付,每阶段约1-3小时

**问题或建议**: 欢迎随时提出调整需求!

1. **Clawdbot Gateway依赖**: MVP需要本地运行Clawdbot Gateway
2. **端口配置**: 默认18789,可通过环境变量配置
3. **Token认证**: 如果Gateway配置了token,需要在.env.local设置
4. **会话持久化**: Clawdbot会话已持久化到`~/.clawdbot/sessions/`
5. **多模态**: MVP不支持图片/文件,仅文本对话

## 🔮 后续扩展方向

- [ ] 多模态支持 (图片上传/显示)
- [ ] 记忆检索UI
- [ ] 多Agent切换
- [ ] 高级配置面板
- [ ] 会话导出/导入
- [ ] 语音输入/输出
- [ ] 移动端适配
- [ ] 桌面应用打包 (Electron/Tauri)

---

**准备开始头脑风暴** 🧠
