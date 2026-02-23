"use client";

import { CheckCircle2, Link2, Plus, Plug, Search, Unplug } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useConnectionStore } from "@/stores/connectionStore";
import { useToastStore } from "@/stores/toastStore";

type ConnectorType = "app" | "custom_api" | "custom_mcp";
type ConnectorStatus = "connected" | "disconnected" | "error" | "draft";

type ConnectorItem = {
  id: string;
  type: ConnectorType;
  name: string;
  description?: string;
  icon?: string;
  status: ConnectorStatus;
  builtin?: boolean;
  enabled?: boolean;
  authMode?: "none" | "api_key" | "oauth";
};

type AddDialogMode = "custom_api" | "custom_mcp";

type OAuthCallbackMessage = {
  type: "openclaw.connector.oauth";
  payload: {
    id: string;
    code: string;
    state: string;
    callbackUrl: string;
    error?: string;
  };
};

const OAUTH_MESSAGE_TYPE = "openclaw.connector.oauth";

function statusClass(status: ConnectorStatus): string {
  if (status === "connected") return "text-green-600";
  if (status === "error") return "text-red-600";
  if (status === "draft") return "text-amber-600";
  return "text-text-tertiary";
}

export function ConnectorsTab() {
  const wsClient = useConnectionStore((state) => state.wsClient);
  const { addToast } = useToastStore();

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | ConnectorType>("all");
  const [items, setItems] = useState<ConnectorItem[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<AddDialogMode>("custom_api");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState("http");
  const [serverUrl, setServerUrl] = useState("");
  const [headersText, setHeadersText] = useState("");
  const [secretName, setSecretName] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!wsClient) return;
    setLoading(true);
    try {
      const result = await wsClient.sendRequest<{ items?: ConnectorItem[] }>("connectors.list", {});
      setItems(result?.items ?? []);
    } catch (error) {
      addToast({
        title: "加载连接器失败",
        description: error instanceof Error ? error.message : "connectors.list failed",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast, wsClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (kind !== "all" && item.type !== kind) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, kind, search]);

  const openAddDialog = (mode: AddDialogMode) => {
    setDialogMode(mode);
    setDialogOpen(true);
    setName("");
    setDescription("");
    setTransport("http");
    setServerUrl("");
    setHeadersText("");
    setSecretName("");
    setSecretValue("");
  };

  const saveCustomConnector = useCallback(async () => {
    if (!wsClient) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      addToast({ title: "名称不能为空", variant: "error" });
      return;
    }

    setIsSaving(true);
    try {
      const id = `custom-${dialogMode}-${trimmedName.toLowerCase().replace(/\s+/g, "-")}`;
      if (dialogMode === "custom_api") {
        const secrets: Record<string, string> = {};
        if (secretName.trim() && secretValue.trim()) {
          secrets[secretName.trim()] = secretValue.trim();
        }
        await wsClient.sendRequest("connectors.upsert", {
          id,
          type: "custom_api",
          name: trimmedName,
          description: description.trim(),
          authMode: "api_key",
          config: {
            note: description.trim(),
            secrets,
          },
        });
      } else {
        let headers: Record<string, string> = {};
        if (headersText.trim()) {
          try {
            const parsed = JSON.parse(headersText) as unknown;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              headers = Object.fromEntries(
                Object.entries(parsed as Record<string, unknown>)
                  .filter(([, value]) => typeof value === "string")
                  .map(([key, value]) => [key, String(value)]),
              );
            }
          } catch {
            addToast({ title: "Headers 不是有效 JSON", variant: "error" });
            return;
          }
        }

        await wsClient.sendRequest("connectors.upsert", {
          id,
          type: "custom_mcp",
          name: trimmedName,
          description: description.trim(),
          authMode: "none",
          config: {
            transport,
            serverUrl: serverUrl.trim(),
            headers,
            note: description.trim(),
          },
        });
      }

      setDialogOpen(false);
      addToast({ title: "连接器已保存", variant: "success" });
      await load();
    } catch (error) {
      addToast({
        title: "保存连接器失败",
        description: error instanceof Error ? error.message : "connectors.upsert failed",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    addToast,
    description,
    dialogMode,
    headersText,
    load,
    name,
    secretName,
    secretValue,
    serverUrl,
    transport,
    wsClient,
  ]);

  const removeConnector = useCallback(
    async (id: string) => {
      if (!wsClient) return;
      try {
        await wsClient.sendRequest("connectors.delete", { id });
        addToast({ title: "连接器已删除", variant: "success" });
        await load();
      } catch (error) {
        addToast({
          title: "删除连接器失败",
          description: error instanceof Error ? error.message : "connectors.delete failed",
          variant: "error",
        });
      }
    },
    [addToast, load, wsClient],
  );

  const startOAuth = useCallback(
    async (id: string) => {
      if (!wsClient) return;
      const callbackUrl = `${window.location.origin}/oauth/connectors/callback?id=${encodeURIComponent(id)}`;
      try {
        const result = await wsClient.sendRequest<{
          authorizeUrl?: string;
        }>("connectors.oauth.start", {
          id,
          callbackUrl,
        });
        const authorizeUrl = result?.authorizeUrl;
        if (!authorizeUrl) {
          throw new Error("authorizeUrl is missing");
        }
        window.open(authorizeUrl, `oauth-${id}`, "width=560,height=780");
      } catch (error) {
        addToast({
          title: "OAuth 启动失败",
          description: error instanceof Error ? error.message : "connectors.oauth.start failed",
          variant: "error",
        });
      }
    },
    [addToast, wsClient],
  );

  useEffect(() => {
    const handler = (event: MessageEvent<OAuthCallbackMessage>) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      if (!event.data || event.data.type !== OAUTH_MESSAGE_TYPE) {
        return;
      }
      const payload = event.data.payload;
      if (payload.error) {
        addToast({
          title: "OAuth 授权失败",
          description: payload.error,
          variant: "error",
        });
        return;
      }
      if (!payload.id || !payload.code || !payload.state || !payload.callbackUrl) {
        addToast({
          title: "OAuth 回调参数不完整",
          variant: "error",
        });
        return;
      }
      if (!wsClient) {
        addToast({ title: "未连接网关", description: "无法完成 OAuth 兑换", variant: "error" });
        return;
      }
      void wsClient
        .sendRequest("connectors.oauth.complete", payload)
        .then(async () => {
          addToast({ title: "连接成功", description: `${payload.id} 已授权`, variant: "success" });
          await load();
        })
        .catch((error) => {
          addToast({
            title: "OAuth 兑换失败",
            description:
              error instanceof Error ? error.message : "connectors.oauth.complete failed",
            variant: "error",
          });
        });
    };

    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, [addToast, load, wsClient]);

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-[260px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-text-tertiary" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索连接器"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openAddDialog("custom_api")}>
            <Plus className="w-4 h-4 mr-1" />
            添加 Custom API
          </Button>
          <Button variant="outline" size="sm" onClick={() => openAddDialog("custom_mcp")}>
            <Plus className="w-4 h-4 mr-1" />
            添加 Custom MCP
          </Button>
        </div>
      </div>

      <Tabs value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
        <TabsList className="bg-surface-subtle">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="app">Apps</TabsTrigger>
          <TabsTrigger value="custom_api">Custom API</TabsTrigger>
          <TabsTrigger value="custom_mcp">Custom MCP</TabsTrigger>
        </TabsList>
        <TabsContent value={kind} className="mt-3">
          <div className="border border-border-light rounded-lg divide-y divide-border-light overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 text-sm text-text-tertiary">加载中...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8 text-sm text-text-tertiary">暂无连接器</div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded border border-border-light flex items-center justify-center text-text-secondary">
                      <Plug className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {item.name}
                      </div>
                      <div className="text-xs text-text-tertiary truncate">
                        {item.description || item.id}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs ${statusClass(item.status)}`}>{item.status}</span>
                    {item.authMode === "oauth" && (
                      <Button
                        size="sm"
                        variant={item.status === "connected" ? "outline" : "default"}
                        onClick={() => startOAuth(item.id)}
                      >
                        {item.status === "connected" ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Reconnect
                          </>
                        ) : (
                          <>
                            <Link2 className="w-3.5 h-3.5 mr-1" />
                            Connect
                          </>
                        )}
                      </Button>
                    )}
                    {!item.builtin && (
                      <Button size="sm" variant="ghost" onClick={() => removeConnector(item.id)}>
                        <Unplug className="w-3.5 h-3.5 mr-1" />
                        删除
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "custom_api" ? "添加 Custom API" : "添加 Custom MCP"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">名称</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如: CRM API"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-secondary">描述</label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="该连接器用于什么场景"
              />
            </div>

            {dialogMode === "custom_api" ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary">Secret Name</label>
                  <Input
                    value={secretName}
                    onChange={(event) => setSecretName(event.target.value)}
                    placeholder="例如: API_KEY"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary">Secret Value</label>
                  <Input
                    type="password"
                    value={secretValue}
                    onChange={(event) => setSecretValue(event.target.value)}
                    placeholder="输入密钥"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary">Transport</label>
                  <select
                    value={transport}
                    onChange={(event) => setTransport(event.target.value)}
                    className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    <option value="http">HTTP</option>
                    <option value="sse">SSE</option>
                    <option value="stdio">STDIO</option>
                    <option value="websocket">WebSocket</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary">Server URL / Command</label>
                  <Input
                    value={serverUrl}
                    onChange={(event) => setServerUrl(event.target.value)}
                    placeholder={
                      transport === "stdio"
                        ? "例如: npx -y @org/mcp-server"
                        : "https://mcp.example.com"
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary">Headers (JSON)</label>
                  <Input
                    value={headersText}
                    onChange={(event) => setHeadersText(event.target.value)}
                    placeholder='例如: {"Authorization":"Bearer xxx"}'
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              取消
            </Button>
            <Button onClick={() => void saveCustomConnector()} disabled={isSaving}>
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
