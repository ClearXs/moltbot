# 虚拟角色与场景功能设计方案

## 1. 需求概述

### 1.1 背景

- 当前系统有独立的「虚拟角色」和「场景」两个入口
- 用户需要：同一个虚拟角色，在不同场景下有不同的表现

### 1.2 核心概念

- **虚拟角色**：一个固定的 AI 角色形象（如 Hovi）
- **场景**：虚拟角色在不同情境下的表现配置（名称 + 描述）
- 一个虚拟角色可以配置多个场景，当前激活的场景决定角色的行为模式

---

## 2. UI/UX 设计

### 2.1 侧边栏改造

**位置**：底部功能区，设置 icon 旁边

**新增元素**：

- 新增一个「虚拟角色设置」icon 按钮（使用 User/Persona 图标）
- 点击后跳转到 `/personas` 详情页

**布局示意**：

```
┌─────────────────────┐
│                     │
│    会话列表区域      │
│                     │
├─────────────────────┤
│ [设置] [配额] [角色] │  ← 底部功能区
└─────────────────────┘
```

### 2.2 虚拟角色详情页

**页面结构**：全屏展示 VRM 模型，浮动配置框

**布局**：

```
┌──────────────────────────────────────────┐
│                                          │
│           VRM 3D 预览区域                 │
│              (全屏)                       │
│                                          │
│                     ┌─────────────────┐  │
│                     │ 当前场景名称    ▼│  │  ← 场景选择器
│                     └─────────────────┘  │
│                                          │
│  ┌──────┐                    ┌────────┐ │
│  │角色配置│                    │场景配置│ │  ← 浮动配置按钮
│  └──────┘                    └────────┘ │
└──────────────────────────────────────────┘
```

### 2.3 场景选择器

**位置**：右下角，VRM 预览区域上方

**功能**：

- 显示当前激活的场景名称
- 点击展开场景下拉列表
- 列表显示所有场景（名称 + 描述）
- 点击场景切换当前激活场景

**UI 示意**：

```
┌────────────────────┐
│ 场景 A (当前)    ▼│  ← 激活状态
│ 场景 B            │
│ 场景 C            │
└────────────────────┘
```

### 2.4 浮动配置按钮

**位置**：右下角，场景选择器上方

**两个按钮**：

1. 「角色配置」- 打开角色配置浮动框
2. 「场景配置」- 打开场景配置浮动框

### 2.5 角色配置浮动框（FloatingPanel）

**引用组件**：violet 项目的 `FloatingPanel` 组件

**配置字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| 名称 | Input | 角色名称 |
| 描述 | Textarea | 角色描述 |
| Emoji | Input | 角色头像 emoji |
| 主题色 | Input | 主题色值 |
| VRM 模型路径 | FilePicker | .vrm 文件路径 |
| 参考音频 | FilePicker | .wav/.mp3 文件路径 |
| 待机动画 | FilePicker | .vmd 动画文件 |
| 语言 | Select | zh/en/ja |

**FloatingPanel 用法**（参考 violet）：

```tsx
<FloatingPanelRoot>
  <FloatingPanelTrigger title="角色配置">
    <Settings className="w-4 h-4" />
  </FloatingPanelTrigger>
  <FloatingPanelContent className="w-96">
    <FloatingPanelForm>
      <FloatingPanelBody>{/* 表单字段 */}</FloatingPanelBody>
      <FloatingPanelFooter>
        <FloatingPanelCloseButton />
      </FloatingPanelFooter>
    </FloatingPanelForm>
  </FloatingPanelContent>
</FloatingPanelRoot>
```

### 2.6 场景配置浮动框

**功能**：管理场景列表

**字段**：
| 字段 | 类型 | 说明 |
|------|------|------|
| 名称 | Input | 场景名称 |
| 描述 | Textarea | 场景描述 |

**UI 结构**：

- 场景列表（左侧或上方）
  - 显示所有场景
  - 点击选中
  - 支持添加、编辑、删除
- 场景编辑表单（右侧或下方）
  - 当前选中场景的配置

---

## 3. 数据结构设计

### 3.1 角色数据（Agent）

```typescript
interface Agent {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  theme?: string;
  activated?: boolean;

  // VRM 配置
  r_path?: string; // 资源目录路径
  config?: {
    vrm?: string; // VRM 模型文件名
    ref_audio?: string; // 参考音频文件名
    prompt_lang?: string; // 语言
    character_setting?: string; // 角色设定文件
    motion?: {
      idle_loop?: string; // 待机动画
    };
  };
}
```

### 3.2 场景数据（Scene）

```typescript
interface Scene {
  id: string;
  agentId: string; // 关联的角色 ID
  name: string; // 场景名称
  description?: string; // 场景描述
  activated?: boolean; // 是否激活
}
```

### 3.3 当前状态

```typescript
interface PersonaState {
  currentAgentId: string; // 当前角色 ID
  currentSceneId: string; // 当前场景 ID
  scenes: Scene[]; // 场景列表
}
```

---

## 4. 页面路由设计

### 4.1 路由结构

| 路径             | 页面                       | 说明                |
| ---------------- | -------------------------- | ------------------- |
| `/personas`      | 虚拟角色详情页             | 全屏 VRM + 浮动配置 |
| `/personas/[id]` | 虚拟角色详情页（指定角色） | 同上，可扩展多角色  |

### 4.2 入口

- 侧边栏底部「虚拟角色设置」icon → 跳转 `/personas`
- 点击场景卡片 → 跳转 `/scenes/[id]` （保留，但整合到详情页）

---

## 5. 组件设计

### 5.1 新增组件

| 组件               | 位置                                        | 说明                       |
| ------------------ | ------------------------------------------- | -------------------------- |
| PersonaDetailPage  | `app/personas/page.tsx`                     | 虚拟角色详情页（全屏 VRM） |
| SceneSelector      | `components/persona/SceneSelector.tsx`      | 场景选择下拉组件           |
| PersonaConfigPanel | `components/persona/PersonaConfigPanel.tsx` | 角色配置浮动框             |
| SceneConfigPanel   | `components/persona/SceneConfigPanel.tsx`   | 场景配置浮动框             |

### 5.2 复用组件

| 组件          | 来源        | 说明        |
| ------------- | ----------- | ----------- |
| FloatingPanel | violet 项目 | 浮动配置框  |
| VrmViewer     | ui-agent    | VRM 3D 渲染 |

---

## 6. API 设计

### 6.1 角色相关

| 方法        | RPC             | 说明         |
| ----------- | --------------- | ------------ |
| fetchAgent  | `agents.get`    | 获取角色详情 |
| updateAgent | `agents.update` | 更新角色配置 |

### 6.2 场景相关

| 方法        | RPC             | 说明         |
| ----------- | --------------- | ------------ |
| fetchScenes | `scenes.list`   | 获取场景列表 |
| createScene | `scenes.create` | 创建场景     |
| updateScene | `scenes.update` | 更新场景     |
| deleteScene | `scenes.delete` | 删除场景     |

---

## 7. 实现顺序

1. **复制 FloatingPanel 组件** - 从 violet 复制到 ui-agent
2. **侧边栏添加入口** - 新增虚拟角色设置 icon
3. **创建详情页** - `/personas` 全屏 VRM 页面
4. **场景选择器** - 右下角场景切换下拉
5. **角色配置浮动框** - FloatingPanel + 表单
6. **场景配置浮动框** - 场景列表管理
7. **场景切换逻辑** - 点击场景切换激活状态

---

## 8. 待确认问题

1. **多角色支持**：是否需要支持多个虚拟角色？（当前设计为单角色）
2. **场景配置扩展**：除了名称和描述，场景是否需要其他配置？（如特定系统提示词）
3. **持久化**：场景切换后是否需要持久化保存？
