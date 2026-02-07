# ui-avatar 集成架构设计文档

## 概述

本文档描述了 ui-avatar（虚拟化身前端）与 moltbot 后端的集成架构。核心原则是 **Persona = Agent**，即前端的 Persona 直接映射到后端的 Agent，无需引入新的概念层。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     ui-avatar (Frontend)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ Scene      │  │ Avatar     │  │ Chat       │            │
│  │ Manager    │  │ Renderer   │  │ Interface  │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│         │              │               │                     │
│         └──────────────┴───────────────┘                     │
│                        │                                     │
│                 WebSocket (Gateway Protocol v3)              │
└────────────────────────┼───────────────────────────────────┘
                         │
┌────────────────────────┼───────────────────────────────────┐
│                        │      moltbot (Backend)            │
│             ┌──────────▼──────────┐                        │
│             │  Gateway Server     │                        │
│             │  (WebSocket + HTTP) │                        │
│             └──────────┬──────────┘                        │
│                        │                                    │
│      ┌─────────────────┼─────────────────┐                │
│      │                 │                 │                │
│  ┌───▼────────┐  ┌────▼─────────┐  ┌───▼──────────┐     │
│  │ Scene RPC  │  │ Agent RPC    │  │ File Routes  │     │
│  │ Methods    │  │ Methods      │  │ (HTTP)       │     │
│  └────────────┘  └──────────────┘  └──────────────┘     │
│       │                 │                │                │
│  ┌────▼────────────────▼────────────────▼─────┐          │
│  │      Agent Workspace File System           │          │
│  │  {workspace}/custom/                       │          │
│  │    ├── vrm/        (VRM 模型文件)          │          │
│  │    └── scenes/     (场景配置和资源)         │          │
│  │         └── scenes.json (场景元数据)        │          │
│  └────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Backend API (已实现)

#### Gateway RPC 方法

- `scenes.list` - 列出所有场景
- `scenes.get` - 获取特定场景
- `scenes.create` - 创建新场景
- `scenes.update` - 更新场景
- `scenes.delete` - 删除场景
- `scenes.setActive` - 设置活动场景

#### HTTP 文件路由

- `GET /files/{agentId}/*` - 访问 VRM 和场景资源文件
- `POST /upload/{agentId}/:type` - 上传 VRM/场景文件

### 2. Frontend 集成层 (待实现)

#### SceneManager (场景管理器)

```typescript
class SceneManager {
  private gateway: GatewayClient;
  private agentId: string;

  // 场景 CRUD 操作
  async listScenes(): Promise<Scene[]>;
  async getScene(id: string): Promise<Scene>;
  async createScene(data: SceneData): Promise<Scene>;
  async updateScene(id: string, updates: Partial<SceneData>): Promise<Scene>;
  async deleteScene(id: string): Promise<void>;
  async setActiveScene(id: string | null): Promise<void>;

  // 文件操作
  async uploadVRM(file: File): Promise<string>;
  async uploadSceneAssets(files: File[]): Promise<string[]>;
  getAssetUrl(agentId: string, relativePath: string): string;
}
```

#### AvatarRenderer (化身渲染器)

```typescript
class AvatarRenderer {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private vrmManager: VRMManager;

  // VRM 加载和管理
  async loadVRM(url: string): Promise<VRM>;
  async switchVRM(url: string): Promise<void>;
  updateAnimation(deltaTime: number): void;

  // 场景控制
  async loadScene(scene: Scene): Promise<void>;
  updateLighting(config: LightingConfig): void;
  updateBackground(config: BackgroundConfig): void;
}
```

#### GatewayClient (WebSocket 客户端)

```typescript
class GatewayClient {
  private ws: WebSocket;
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve; reject }>;

  // 连接管理
  async connect(url: string, agentId: string): Promise<void>;
  disconnect(): void;

  // RPC 调用
  async call(method: string, params: any): Promise<any>;

  // 事件监听
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
}
```

## 数据模型

### Scene 结构

```typescript
interface Scene {
  id: string; // UUID
  name: string; // 场景名称
  description: string; // 场景描述
  r_path: string; // 场景资源相对路径
  main_file: string; // 主场景文件
  thumb: string | null; // 缩略图路径
  active: boolean; // 是否为活动场景
  created_at: string; // 创建时间 (ISO 8601)
  updated_at: string; // 更新时间 (ISO 8601)
  user_id: string; // 所属 agent ID
}
```

### SceneData (创建场景时使用)

```typescript
interface SceneData {
  name: string;
  description?: string;
  r_path: string;
  main_file: string;
  thumb?: string;
}
```

## 通信协议

### Gateway Protocol v3 (WebSocket)

#### 请求格式

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "method": "scenes.list",
  "params": {
    "agentId": "default"
  }
}
```

#### 响应格式

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "result": {
    "scenes": [...],
    "activeSceneId": "uuid-123"
  }
}
```

#### 错误响应

```json
{
  "jsonrpc": "2.0",
  "id": 123,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Scene not found"
  }
}
```

### HTTP 文件访问

#### 获取资源文件

```
GET /files/{agentId}/custom/vrm/model.vrm
GET /files/{agentId}/custom/scenes/scene1/main.glb
```

#### 上传文件

```
POST /upload/{agentId}/vrm
POST /upload/{agentId}/scenes

Content-Type: multipart/form-data
```

## 实现步骤 (Week 2)

### Phase 1: 基础连接层

1. 实现 GatewayClient WebSocket 连接
2. 实现 RPC 调用机制
3. 添加连接状态管理和重连逻辑

### Phase 2: 场景管理集成

1. 实现 SceneManager API 封装
2. 创建场景列表 UI 组件
3. 实现场景 CRUD 操作界面
4. 添加文件上传功能

### Phase 3: VRM 和场景渲染

1. 集成 three-vrm 库
2. 实现 VRM 加载和切换
3. 实现场景加载和渲染
4. 添加动画和交互控制

### Phase 4: 状态同步

1. 实现活动场景状态同步
2. 添加场景切换动画
3. 实现多设备场景同步（可选）

## 安全考虑

1. **文件路径验证**：后端已实现路径安全检查，确保文件访问在 workspace 内
2. **文件类型验证**：上传时验证文件扩展名
3. **agentId 验证**：使用正则表达式验证 agentId 格式
4. **文件大小限制**：建议添加上传文件大小限制（如 50MB）

## 性能优化

1. **缓存策略**：
   - 场景列表缓存（5分钟）
   - VRM 模型缓存（本地存储）
   - 场景资源预加载

2. **懒加载**：
   - 场景缩略图懒加载
   - VRM 模型按需加载
   - 场景资源分块加载

3. **压缩**：
   - 使用 Draco 压缩 GLB/GLTF
   - WebSocket 消息压缩
   - HTTP 响应 gzip

## 配置示例

### scenes.json 格式

```json
{
  "scenes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "虚拟办公室",
      "description": "现代办公室环境",
      "r_path": "scenes/office",
      "main_file": "office.glb",
      "thumb": "scenes/office/thumb.jpg",
      "active": true,
      "created_at": "2026-01-30T10:00:00Z",
      "updated_at": "2026-01-30T10:00:00Z",
      "user_id": "default"
    }
  ],
  "activeSceneId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## 未来扩展

1. **实时协作**：多用户场景共享和协作
2. **场景模板**：预定义场景模板库
3. **动画系统**：场景和化身的自定义动画
4. **AI 集成**：基于对话内容的自动场景切换
5. **性能监控**：FPS 监控和渲染性能优化

## 参考资料

- [three-vrm 文档](https://github.com/pixiv/three-vrm)
- [Gateway Protocol v3 规范](../../gateway/protocol/)
- [moltbot 配置指南](../../config/)
