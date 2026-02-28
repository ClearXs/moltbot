"use client";

import {
  Bot,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCcw,
  Eye,
  EyeOff,
  Copy,
  Search,
  Pencil,
  Save,
  X,
  AlertTriangle,
  Check,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useConnectionStore } from "@/stores/connectionStore";
import { useToastStore } from "@/stores/toastStore";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface ModelCatalogEntry {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

interface ModelCost {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

interface ModelDefinition {
  id: string;
  name?: string;
  api?: string;
  reasoning?: boolean;
  input?: string[];
  cost?: ModelCost;
  contextWindow?: number;
  maxTokens?: number;
}

interface ModelProvider {
  baseUrl: string;
  apiKey?: string;
  auth?: string;
  api?: string;
  models: ModelDefinition[];
}

type ProvidersMap = Record<string, ModelProvider>;

const API_TYPES = [
  { value: "openai-completions", label: "OpenAI Completions" },
  { value: "openai-responses", label: "OpenAI Responses" },
  { value: "anthropic-messages", label: "Anthropic Messages" },
  { value: "google-generative-ai", label: "Google Generative AI" },
  { value: "bedrock-converse-stream", label: "AWS Bedrock" },
];

const AUTH_MODES = [
  { value: "api-key", label: "API Key" },
  { value: "token", label: "Token" },
  { value: "oauth", label: "OAuth" },
  { value: "aws-sdk", label: "AWS SDK" },
];

/* ------------------------------------------------------------------ */
/*  Helper components                                                   */
/* ------------------------------------------------------------------ */

function ApiKeyField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const { addToast } = useToastStore();

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex-1">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "sk-..."}
          className="h-8 text-xs pr-8 font-mono"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0 flex-shrink-0"
        onClick={() => {
          if (value) {
            void navigator.clipboard?.writeText(value);
            addToast({ title: "已复制", description: "API Key 已复制到剪贴板" });
          }
        }}
        title="复制"
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

function ModelRow({ model }: { model: ModelDefinition }) {
  const costStr = model.cost ? `$${model.cost.input ?? 0}/${model.cost.output ?? 0}` : "—";

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-surface-hover text-xs">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="font-mono text-text-primary truncate">{model.id}</span>
        {model.reasoning && (
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            reasoning
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-text-tertiary">
        <span title="Cost (input/output per 1M tokens)">{costStr}</span>
        {model.contextWindow && (
          <span title="Context window">
            {model.contextWindow >= 1000
              ? `${Math.round(model.contextWindow / 1000)}K`
              : model.contextWindow}
          </span>
        )}
        {model.maxTokens && (
          <span title="Max output tokens">
            max{" "}
            {model.maxTokens >= 1000 ? `${Math.round(model.maxTokens / 1000)}K` : model.maxTokens}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Provider Dialog                                                 */
/* ------------------------------------------------------------------ */

function AddProviderDialog({
  open,
  onOpenChange,
  onAdd,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (name: string, provider: Omit<ModelProvider, "models">) => void;
  existingNames: string[];
}) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [api, setApi] = useState("openai-completions");
  const [auth, setAuth] = useState("api-key");
  const [apiKey, setApiKey] = useState("");

  const nameError = name && existingNames.includes(name.toLowerCase()) ? "该提供商名称已存在" : "";

  const canSubmit = name.trim() && baseUrl.trim() && !nameError;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onAdd(name.trim().toLowerCase(), {
      baseUrl: baseUrl.trim(),
      api,
      auth,
      apiKey: apiKey || undefined,
    });
    setName("");
    setBaseUrl("");
    setApi("openai-completions");
    setAuth("api-key");
    setApiKey("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>添加模型提供商</DialogTitle>
          <DialogDescription>配置新的模型提供商以使用自定义 API 端点。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">
              提供商名称 <span className="text-error">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-provider"
              className="h-8 text-xs"
            />
            {nameError && <p className="text-xs text-error mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="text-xs text-text-secondary mb-1 block">
              Base URL <span className="text-error">*</span>
            </label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="h-8 text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-text-secondary mb-1 block">API 类型</label>
            <select
              value={api}
              onChange={(e) => setApi(e.target.value)}
              className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
            >
              {API_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-secondary mb-1 block">认证方式</label>
            <select
              value={auth}
              onChange={(e) => setAuth(e.target.value)}
              className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
            >
              {AUTH_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {(auth === "api-key" || auth === "token") && (
            <div>
              <label className="text-xs text-text-secondary mb-1 block">API Key</label>
              <ApiKeyField value={apiKey} onChange={setApiKey} placeholder="sk-..." />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Remove Provider Dialog                                              */
/* ------------------------------------------------------------------ */

function RemoveProviderDialog({
  open,
  providerName,
  onOpenChange,
  onConfirm,
  isRemoving,
}: {
  open: boolean;
  providerName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isRemoving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[24rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            确认删除提供商
          </DialogTitle>
          <DialogDescription>此操作不可撤销。</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-text-primary mb-3">
            确定要删除提供商 <strong className="capitalize">{providerName}</strong> 吗？
          </p>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              删除后，该提供商下的所有模型配置和 API Key 将被移除。使用该提供商模型的 Agent
              配置可能需要手动更新。
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isRemoving}
          >
            取消
          </Button>
          <Button size="sm" variant="destructive" onClick={onConfirm} disabled={isRemoving}>
            {isRemoving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                删除中...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                确认删除
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Add Model Dialog                                                      */
/* ------------------------------------------------------------------ */

function AddModelDialog({
  open,
  onOpenChange,
  onAdd,
  catalog,
  providerName,
  existingModelIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (model: ModelDefinition) => void;
  catalog: ModelCatalogEntry[];
  providerName: string;
  existingModelIds: string[];
}) {
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [modelId, setModelId] = useState("");
  const [name, setName] = useState("");
  const [contextWindow, setContextWindow] = useState("");
  const [maxTokens, setMaxTokens] = useState("");
  const [reasoning, setReasoning] = useState(false);

  // 获取该提供商的可用模型（排除已添加的）
  const availableModels = useMemo(() => {
    return catalog
      .filter((m) => m.provider.toLowerCase() === providerName.toLowerCase())
      .filter((m) => !existingModelIds.includes(m.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, providerName, existingModelIds]);

  const canSubmit = mode === "select" ? selectedModel !== "" : modelId.trim() !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;

    if (mode === "select") {
      // 从目录中选择
      const catalogModel = availableModels.find((m) => m.id === selectedModel);
      if (catalogModel) {
        onAdd({
          id: catalogModel.id,
          name: catalogModel.name,
          contextWindow: catalogModel.contextWindow,
          reasoning: catalogModel.reasoning,
        });
      }
    } else {
      // 手动填写
      onAdd({
        id: modelId.trim(),
        name: name.trim() ? name.trim() : undefined,
        contextWindow: contextWindow ? parseInt(contextWindow, 10) : undefined,
        maxTokens: maxTokens ? parseInt(maxTokens, 10) : undefined,
        reasoning: reasoning || undefined,
      });
    }

    // Reset form
    setSelectedModel("");
    setModelId("");
    setName("");
    setContextWindow("");
    setMaxTokens("");
    setReasoning(false);
    setMode("select");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[28rem]">
        <DialogHeader>
          <DialogTitle>添加模型</DialogTitle>
          <DialogDescription>从模型目录选择或手动添加模型。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 模式切换 */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "select" ? "default" : "outline"}
              onClick={() => setMode("select")}
              className="flex-1"
            >
              从目录选择
            </Button>
            <Button
              size="sm"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => setMode("manual")}
              className="flex-1"
            >
              手动填写
            </Button>
          </div>

          {mode === "select" ? (
            <div>
              <label className="text-xs text-text-secondary mb-1 block">
                选择模型 <span className="text-error">*</span>
              </label>
              {availableModels.length === 0 ? (
                <p className="text-xs text-text-tertiary py-2">
                  该提供商没有可用模型，或已全部添加
                </p>
              ) : (
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
                >
                  <option value="">请选择模型...</option>
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.id}
                      {m.contextWindow ? ` (${Math.round(m.contextWindow / 1000)}K)` : ""}
                      {m.reasoning ? " 🧠" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">
                  模型 ID <span className="text-error">*</span>
                </label>
                <Input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="gpt-4o, claude-3-opus"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-text-secondary mb-1 block">显示名称</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="GPT-4o (可选)"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-secondary mb-1 block">上下文窗口</label>
                  <Input
                    value={contextWindow}
                    onChange={(e) => setContextWindow(e.target.value.replace(/\D/g, ""))}
                    placeholder="128000"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary mb-1 block">最大输出</label>
                  <Input
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value.replace(/\D/g, ""))}
                    placeholder="4096"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reasoning"
                  checked={reasoning}
                  onChange={(e) => setReasoning(e.target.checked)}
                  className="rounded border-border-light"
                />
                <label htmlFor="reasoning" className="text-xs text-text-secondary">
                  推理模型 (Reasoning)
                </label>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider Card (with editable Base URL)                              */
/* ------------------------------------------------------------------ */

function ProviderCard({
  name,
  provider,
  onApiKeyChange,
  onBaseUrlChange,
  onRemove,
  currentDefaultModel,
  onSetDefault,
  onAddFallback,
  onAddModel,
}: {
  name: string;
  provider: ModelProvider;
  onApiKeyChange: (key: string) => void;
  onBaseUrlChange: (url: string) => void;
  onRemove: () => void;
  currentDefaultModel?: string;
  onSetDefault?: (modelId: string) => void;
  onAddFallback?: (modelId: string) => void;
  onAddModel?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [baseUrlDraft, setBaseUrlDraft] = useState(provider.baseUrl);

  const authLabel =
    provider.auth === "aws-sdk"
      ? "AWS SDK"
      : provider.auth === "oauth"
        ? "OAuth"
        : provider.auth === "token"
          ? "Token"
          : "API Key";

  const handleSaveBaseUrl = () => {
    const trimmed = baseUrlDraft.trim();
    if (trimmed && trimmed !== provider.baseUrl) {
      onBaseUrlChange(trimmed);
    }
    setEditingBaseUrl(false);
  };

  const handleCancelBaseUrl = () => {
    setBaseUrlDraft(provider.baseUrl);
    setEditingBaseUrl(false);
  };

  return (
    <div className="border border-border-light rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <button type="button" className="text-text-tertiary">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <div>
            <div className="text-sm font-medium text-text-primary capitalize">{name}</div>
            <div className="text-xs text-text-tertiary">
              {provider.models.length} 个模型 · {authLabel} · {provider.api ?? "auto"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary truncate max-w-[200px]">
            {provider.baseUrl}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-text-tertiary hover:text-error"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="移除此提供商"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-light px-4 py-3 space-y-3">
          {(provider.auth === "api-key" || !provider.auth) && (
            <div>
              <label className="text-xs text-text-secondary mb-1 block">API Key</label>
              <ApiKeyField
                value={provider.apiKey ?? ""}
                onChange={onApiKeyChange}
                placeholder={`输入 ${name} API Key`}
              />
            </div>
          )}

          <div>
            <label className="text-xs text-text-secondary mb-1 block">Base URL</label>
            {editingBaseUrl ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={baseUrlDraft}
                  onChange={(e) => setBaseUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveBaseUrl();
                    if (e.key === "Escape") handleCancelBaseUrl();
                  }}
                  className="h-8 text-xs font-mono flex-1"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={handleSaveBaseUrl}
                  title="保存"
                >
                  <Save className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={handleCancelBaseUrl}
                  title="取消"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Input
                  value={provider.baseUrl}
                  readOnly
                  className="h-8 text-xs font-mono bg-surface-subtle flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => {
                    setBaseUrlDraft(provider.baseUrl);
                    setEditingBaseUrl(true);
                  }}
                  title="编辑"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {provider.models.length > 0 && (
            <div>
              <label className="text-xs text-text-secondary mb-1 block">
                模型列表 ({provider.models.length})
              </label>
              <div className="bg-surface-subtle rounded-md divide-y divide-border-light max-h-[200px] overflow-y-auto">
                {provider.models.map((model) => {
                  const isDefault = currentDefaultModel === model.id;
                  return (
                    <div
                      key={model.id}
                      className="flex items-center justify-between py-2 px-3 text-xs hover:bg-surface-hover"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-text-primary truncate">{model.id}</span>
                        {model.reasoning && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            reasoning
                          </span>
                        )}
                        {isDefault && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> 主模型
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!isDefault && onSetDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] text-text-tertiary hover:text-primary"
                            onClick={() => onSetDefault(model.id)}
                            title="设为主模型"
                          >
                            <Star className="w-3 h-3 mr-1" />
                            设为主
                          </Button>
                        )}
                        {!isDefault && onAddFallback && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] text-text-tertiary hover:text-primary"
                            onClick={() => onAddFallback(model.id)}
                            title="添加为备用模型"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            备用
                          </Button>
                        )}
                        <div className="flex items-center gap-3 flex-shrink-0 text-text-tertiary">
                          {model.contextWindow && (
                            <span title="Context window">
                              {model.contextWindow >= 1000
                                ? `${Math.round(model.contextWindow / 1000)}K`
                                : model.contextWindow}
                            </span>
                          )}
                          {model.maxTokens && (
                            <span title="Max output tokens">
                              max{" "}
                              {model.maxTokens >= 1000
                                ? `${Math.round(model.maxTokens / 1000)}K`
                                : model.maxTokens}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {onAddModel && (
            <Button
              size="sm"
              variant="outline"
              className="mt-3 w-full text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAddModel();
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              添加模型
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                       */
/* ------------------------------------------------------------------ */

export function ModelsTab({ onClose }: { onClose?: () => void }) {
  const { addToast } = useToastStore();

  const [catalog, setCatalog] = useState<ModelCatalogEntry[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProvidersMap>({});
  const [configHash, setConfigHash] = useState<string | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // 当前默认模型和备用模型
  const [currentDefaultModel, setCurrentDefaultModel] = useState<string>("");
  const [currentFallbackModels, setCurrentFallbackModels] = useState<string[]>([]);

  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [addModelProvider, setAddModelProvider] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [search, setSearch] = useState("");

  const wsClient = useConnectionStore((s) => s.wsClient);

  const loadCatalog = useCallback(async () => {
    if (!wsClient) {
      setCatalogError("未连接到网关");
      return;
    }
    setIsCatalogLoading(true);
    setCatalogError(null);
    try {
      const result = await wsClient.sendRequest<{ models: ModelCatalogEntry[] }>("models.list", {});
      setCatalog(result?.models ?? []);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : "加载模型列表失败");
    } finally {
      setIsCatalogLoading(false);
    }
  }, [wsClient]);

  const loadConfig = useCallback(async () => {
    if (!wsClient) return;
    setIsConfigLoading(true);
    setConfigError(null);
    try {
      const result = await wsClient.sendRequest<{
        raw: string;
        hash: string;
        parsed?: Record<string, unknown>;
      }>("config.get", {});
      const parsed = result?.parsed ?? (result?.raw ? JSON.parse(result.raw) : null);
      setConfigHash(result?.hash ?? null);
      const modelsProviders = (parsed?.models as Record<string, unknown>)?.providers;
      if (modelsProviders && typeof modelsProviders === "object") {
        setProviders(modelsProviders as ProvidersMap);
      }
      // 读取默认模型配置
      const agentsDefaults = parsed?.agents?.defaults as Record<string, unknown> | undefined;
      const modelConfig = agentsDefaults?.model;
      if (typeof modelConfig === "string") {
        setCurrentDefaultModel(modelConfig);
        setCurrentFallbackModels([]);
      } else if (modelConfig && typeof modelConfig === "object") {
        setCurrentDefaultModel(((modelConfig as Record<string, unknown>).primary as string) || "");
        const fallbacks = (modelConfig as Record<string, unknown>).fallbacks;
        setCurrentFallbackModels(
          Array.isArray(fallbacks)
            ? fallbacks.filter((f): f is string => typeof f === "string")
            : [],
        );
      } else {
        setCurrentDefaultModel("");
        setCurrentFallbackModels([]);
      }
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "加载配置失败");
    } finally {
      setIsConfigLoading(false);
    }
  }, [wsClient]);

  useEffect(() => {
    void loadCatalog();
    void loadConfig();
  }, [loadCatalog, loadConfig]);

  const grouped = useMemo(() => {
    const map = new Map<string, ModelCatalogEntry[]>();
    const q = search.toLowerCase();
    for (const m of catalog) {
      if (
        q &&
        !m.id.toLowerCase().includes(q) &&
        !m.name.toLowerCase().includes(q) &&
        !m.provider.toLowerCase().includes(q)
      )
        continue;
      const list = map.get(m.provider) ?? [];
      list.push(m);
      map.set(m.provider, list);
    }
    return map;
  }, [catalog, search]);

  const patchProvider = useCallback(
    async (providerName: string, value: Record<string, unknown> | null) => {
      if (!wsClient) return false;
      try {
        const result = await wsClient.sendRequest<{ hash?: string }>("config.patch", {
          raw: JSON.stringify({ models: { providers: { [providerName]: value } } }),
          baseHash: configHash,
        });
        if (result?.hash) setConfigHash(result.hash);
        return true;
      } catch (err) {
        addToast({
          title: "保存失败",
          description: err instanceof Error ? err.message : "未知错误",
          variant: "error",
        });
        return false;
      }
    },
    [wsClient, configHash, addToast],
  );

  const handleApiKeyChange = useCallback(
    async (providerName: string, apiKey: string) => {
      const ok = await patchProvider(providerName, { apiKey });
      if (ok) {
        setProviders((prev) => ({ ...prev, [providerName]: { ...prev[providerName], apiKey } }));
        addToast({ title: "已更新", description: `${providerName} API Key 已保存` });
      }
    },
    [patchProvider, addToast],
  );

  const handleBaseUrlChange = useCallback(
    async (providerName: string, baseUrl: string) => {
      const ok = await patchProvider(providerName, { baseUrl });
      if (ok) {
        setProviders((prev) => ({ ...prev, [providerName]: { ...prev[providerName], baseUrl } }));
        addToast({ title: "已更新", description: `${providerName} Base URL 已保存` });
      }
    },
    [patchProvider, addToast],
  );

  // 设置默认模型
  const handleSetDefaultModel = useCallback(
    async (modelId: string) => {
      if (!wsClient || !configHash) return;
      try {
        const result = await wsClient.sendRequest<{ hash?: string }>("config.patch", {
          raw: JSON.stringify({
            agents: { defaults: { model: { primary: modelId, fallbacks: currentFallbackModels } } },
          }),
          baseHash: configHash,
        });
        if (result?.hash) {
          setConfigHash(result.hash);
          setCurrentDefaultModel(modelId);
          addToast({ title: "已设置", description: `默认模型已设置为 ${modelId}` });
        }
      } catch (err) {
        addToast({
          title: "设置失败",
          description: err instanceof Error ? err.message : "未知错误",
          variant: "error",
        });
      }
    },
    [wsClient, configHash, currentFallbackModels, addToast],
  );

  // 添加备用模型
  const handleAddFallbackModel = useCallback(
    async (modelId: string) => {
      if (!wsClient || !configHash) return;
      const newFallbacks = [...currentFallbackModels, modelId];
      try {
        const result = await wsClient.sendRequest<{ hash?: string }>("config.patch", {
          raw: JSON.stringify({
            agents: {
              defaults: { model: { primary: currentDefaultModel, fallbacks: newFallbacks } },
            },
          }),
          baseHash: configHash,
        });
        if (result?.hash) {
          setConfigHash(result.hash);
          setCurrentFallbackModels(newFallbacks);
          addToast({ title: "已添加", description: `${modelId} 已添加为备用模型` });
        }
      } catch (err) {
        addToast({
          title: "添加失败",
          description: err instanceof Error ? err.message : "未知错误",
          variant: "error",
        });
      }
    },
    [wsClient, configHash, currentDefaultModel, currentFallbackModels, addToast],
  );

  const handleAddProvider = useCallback(
    async (name: string, data: Omit<ModelProvider, "models">) => {
      const payload: Record<string, unknown> = {
        baseUrl: data.baseUrl,
        api: data.api,
        auth: data.auth,
        models: [],
      };
      if (data.apiKey) payload.apiKey = data.apiKey;
      const ok = await patchProvider(name, payload);
      if (ok) {
        setProviders((prev) => ({ ...prev, [name]: { ...data, models: [] } }));
        setAddProviderOpen(false);
        addToast({ title: "已添加", description: `提供商 ${name} 已成功添加` });
      }
    },
    [patchProvider, addToast],
  );

  const handleAddModel = useCallback(
    async (providerName: string, model: ModelDefinition) => {
      const provider = providers[providerName];
      if (!provider) return;

      const newModels = [...provider.models, model];
      const ok = await patchProvider(providerName, { models: newModels });
      if (ok) {
        setProviders((prev) => ({
          ...prev,
          [providerName]: { ...prev[providerName], models: newModels },
        }));
        setAddModelOpen(false);
        setAddModelProvider(null);
        addToast({ title: "已添加", description: `模型 ${model.id} 已添加到 ${providerName}` });
      }
    },
    [providers, patchProvider, addToast],
  );

  const handleRemoveProvider = useCallback(
    async (providerName: string) => {
      setIsRemoving(true);
      const ok = await patchProvider(providerName, null);
      setIsRemoving(false);
      if (ok) {
        setProviders((prev) => {
          const next = { ...prev };
          delete next[providerName];
          return next;
        });
        setRemoveTarget(null);
        addToast({ title: "已删除", description: `提供商 ${providerName} 已移除` });
      }
    },
    [patchProvider, addToast],
  );

  if (isCatalogLoading && isConfigLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-text-tertiary animate-spin mb-3" />
        <p className="text-sm text-text-tertiary">加载模型信息...</p>
      </div>
    );
  }

  if (catalogError && catalog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
        <AlertCircle className="w-10 h-10 text-error mb-3" />
        <p className="text-sm text-text-primary mb-1">加载模型列表失败</p>
        <p className="text-xs text-text-tertiary mb-4">{catalogError}</p>
        <Button size="sm" variant="outline" onClick={() => void loadCatalog()}>
          <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">可用模型</h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            共 {catalog.length} 个模型，来自 {grouped.size} 个提供商
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索模型..."
              className="h-8 text-xs pl-8 w-[200px]"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setAddProviderOpen(true)}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            添加提供商
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              void loadCatalog();
              void loadConfig();
            }}
          >
            <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
            刷新
          </Button>
        </div>
      </div>

      {Object.keys(providers).length > 0 && (
        <section className="mb-6">
          <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            已配置的提供商
          </h4>
          <div className="space-y-2">
            {Object.entries(providers).map(([pname, provider]) => (
              <ProviderCard
                key={pname}
                name={pname}
                provider={provider}
                onApiKeyChange={(key) => void handleApiKeyChange(pname, key)}
                onBaseUrlChange={(url) => void handleBaseUrlChange(pname, url)}
                onRemove={() => setRemoveTarget(pname)}
                currentDefaultModel={currentDefaultModel}
                onSetDefault={handleSetDefaultModel}
                onAddFallback={handleAddFallbackModel}
                onAddModel={() => {
                  setAddModelProvider(pname);
                  setAddModelOpen(true);
                }}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
          模型目录
        </h4>
        {grouped.size === 0 ? (
          <div className="text-center py-8 text-sm text-text-tertiary">
            {search ? "没有找到匹配的模型" : "暂无可用模型"}
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([provider, models]) => (
              <div key={provider}>
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-3.5 h-3.5 text-text-tertiary" />
                  <span className="text-xs font-medium text-text-secondary capitalize">
                    {provider}
                  </span>
                  <span className="text-[10px] text-text-tertiary">({models.length})</span>
                </div>
                <div className="bg-surface-subtle rounded-md divide-y divide-border-light">
                  {models.map((model) => (
                    <div
                      key={model.id}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono text-text-primary truncate">{model.id}</span>
                        {model.reasoning && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                            reasoning
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-text-tertiary">
                        {model.contextWindow && (
                          <span>
                            {model.contextWindow >= 1000
                              ? `${Math.round(model.contextWindow / 1000)}K ctx`
                              : `${model.contextWindow} ctx`}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 pt-4 border-t border-border-light">
        <p className="text-xs text-text-tertiary">
          模型配置存储在{" "}
          <code className="bg-surface-subtle px-1 rounded">~/.openclaw/config.json5</code> 的
          <code className="bg-surface-subtle px-1 rounded">models.providers</code> 中。
        </p>
      </div>

      <AddProviderDialog
        open={addProviderOpen}
        onOpenChange={setAddProviderOpen}
        onAdd={(pname, data) => void handleAddProvider(pname, data)}
        existingNames={Object.keys(providers)}
      />

      <AddModelDialog
        open={addModelOpen}
        onOpenChange={(open) => {
          setAddModelOpen(open);
          if (!open) setAddModelProvider(null);
        }}
        onAdd={(model) => {
          if (addModelProvider) {
            void handleAddModel(addModelProvider, model);
          }
        }}
        catalog={catalog}
        providerName={addModelProvider || ""}
        existingModelIds={
          addModelProvider ? providers[addModelProvider]?.models.map((m) => m.id) || [] : []
        }
      />

      {removeTarget && (
        <RemoveProviderDialog
          open={!!removeTarget}
          providerName={removeTarget}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null);
          }}
          onConfirm={() => void handleRemoveProvider(removeTarget)}
          isRemoving={isRemoving}
        />
      )}
    </div>
  );
}
