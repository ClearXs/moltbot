"use client";

import {
  Palette,
  Lock,
  Bot,
  MessageSquare,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  RefreshCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore, type OpenClawConfigPartial } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";

/* ------------------------------------------------------------------ */
/*  Utility: deep get / deep set on nested objects                      */
/* ------------------------------------------------------------------ */

function deepGet(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  const result = structuredClone(obj);
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

/* ------------------------------------------------------------------ */
/*  Section header                                                       */
/* ------------------------------------------------------------------ */

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-text-tertiary">{icon}</span>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field row                                                            */
/* ------------------------------------------------------------------ */

function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text-primary">{label}</div>
        {description && <div className="text-xs text-text-tertiary mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0 w-[260px]">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                       */
/* ------------------------------------------------------------------ */

export function GeneralSettingsTab() {
  const { config, isLoadingConfig, isSavingConfig, configError, loadConfig, patchConfig } =
    useSettingsStore();
  const { addToast } = useToastStore();

  // Local form state (mirrors config, edits are local until save)
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Sync remote config → local form when loaded
  useEffect(() => {
    if (config) {
      setForm(config as Record<string, unknown>);
      setDirty(false);
    }
  }, [config]);

  const getValue = useCallback(
    (path: string): unknown => deepGet(form, path),
    [form],
  );

  const setValue = useCallback((path: string, value: unknown) => {
    setForm((prev) => deepSet(prev, path, value));
    setDirty(true);
  }, []);

  const stringVal = useCallback(
    (path: string) => {
      const v = getValue(path);
      return typeof v === "string" ? v : "";
    },
    [getValue],
  );

  const numberVal = useCallback(
    (path: string) => {
      const v = getValue(path);
      return typeof v === "number" ? v : undefined;
    },
    [getValue],
  );

  const boolVal = useCallback(
    (path: string) => {
      const v = getValue(path);
      return v === true;
    },
    [getValue],
  );

  /** Resolve agents.defaults.model to primary string */
  const modelPrimary = useCallback(() => {
    const m = getValue("agents.defaults.model");
    if (typeof m === "string") return m;
    if (m && typeof m === "object" && "primary" in (m as Record<string, unknown>)) {
      return String((m as Record<string, unknown>).primary ?? "");
    }
    return "";
  }, [getValue]);

  const handleSave = async () => {
    // Build patch from local form diff
    const patch = buildPatch(form, config as Record<string, unknown> | null);
    if (Object.keys(patch).length === 0) {
      addToast({ title: "无变更", description: "配置未发生变化" });
      return;
    }

    const result = await patchConfig(patch);
    if (result.ok) {
      setDirty(false);
      addToast({
        title: "配置已保存",
        description: result.needsRestart ? "部分更改需要重启网关才能生效" : "设置已成功更新",
      });
    } else {
      addToast({
        title: "保存失败",
        description: result.error ?? "未知错误",
        variant: "error",
      });
    }
  };

  const handleReset = () => {
    if (config) {
      setForm(config as Record<string, unknown>);
      setDirty(false);
    }
  };

  const handleCopyToken = () => {
    const token = stringVal("gateway.auth.token");
    if (token) {
      void navigator.clipboard?.writeText(token);
      addToast({ title: "已复制", description: "Token 已复制到剪贴板" });
    }
  };

  // Loading state
  if (isLoadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-text-tertiary animate-spin mb-3" />
        <p className="text-sm text-text-tertiary">加载配置中...</p>
      </div>
    );
  }

  // Error state
  if (configError && !config) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
        <AlertCircle className="w-10 h-10 text-error mb-3" />
        <p className="text-sm text-text-primary mb-1">加载配置失败</p>
        <p className="text-xs text-text-tertiary mb-4">{configError}</p>
        <Button size="sm" variant="outline" onClick={() => void loadConfig()}>
          <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* ---- UI 自定义 ---- */}
      <section>
        <SectionHeader icon={<Palette className="w-4 h-4" />} title="界面个性化" />

        <FieldRow label="主题色" description="界面强调色,影响按钮和高亮元素颜色">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={stringVal("ui.seamColor") || "#6366f1"}
              onChange={(e) => setValue("ui.seamColor", e.target.value)}
              className="w-8 h-8 rounded border border-border-light cursor-pointer"
            />
            <Input
              value={stringVal("ui.seamColor") || ""}
              onChange={(e) => setValue("ui.seamColor", e.target.value)}
              placeholder="#6366f1"
              className="h-8 text-xs flex-1"
            />
          </div>
        </FieldRow>

        <FieldRow label="助手名称" description="助手在对话中显示的名称">
          <Input
            value={stringVal("ui.assistant.name") || ""}
            onChange={(e) => setValue("ui.assistant.name", e.target.value)}
            placeholder="Assistant"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="助手头像" description="支持 Emoji、短文本或图片 URL">
          <Input
            value={stringVal("ui.assistant.avatar") || ""}
            onChange={(e) => setValue("ui.assistant.avatar", e.target.value)}
            placeholder="🤖 或 图片 URL"
            className="h-8 text-xs"
          />
        </FieldRow>
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- 网关认证 ---- */}
      <section>
        <SectionHeader icon={<Lock className="w-4 h-4" />} title="网关认证" />

        <FieldRow label="认证模式">
          <select
            value={stringVal("gateway.auth.mode") || "token"}
            onChange={(e) => setValue("gateway.auth.mode", e.target.value)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="token">Token 认证</option>
            <option value="password">密码认证</option>
          </select>
        </FieldRow>

        <FieldRow label="Gateway Token" description="用于 CLI 和 API 认证的共享 Token">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Input
                type={showToken ? "text" : "password"}
                value={stringVal("gateway.auth.token") || ""}
                onChange={(e) => setValue("gateway.auth.token", e.target.value)}
                placeholder="输入 Token"
                className="h-8 text-xs pr-8"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={handleCopyToken}
              title="复制 Token"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </div>
        </FieldRow>

        <FieldRow label="Gateway 密码" description="密码认证模式下使用">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={stringVal("gateway.auth.password") || ""}
              onChange={(e) => setValue("gateway.auth.password", e.target.value)}
              placeholder="输入密码"
              className="h-8 text-xs pr-8"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
        </FieldRow>

        <FieldRow label="允许 Tailscale 认证" description="启用后 Tailscale 身份头可用于认证">
          <label className="flex items-center gap-2 cursor-pointer justify-end">
            <input
              type="checkbox"
              checked={boolVal("gateway.auth.allowTailscale")}
              onChange={(e) => setValue("gateway.auth.allowTailscale", e.target.checked)}
              className="rounded border-border-light"
            />
          </label>
        </FieldRow>
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- Agent 默认配置 ---- */}
      <section>
        <SectionHeader icon={<Bot className="w-4 h-4" />} title="Agent 默认配置" />

        <FieldRow label="默认模型" description="Agent 使用的主要 LLM 模型">
          <Input
            value={modelPrimary()}
            onChange={(e) => setValue("agents.defaults.model", { primary: e.target.value })}
            placeholder="anthropic/claude-sonnet-4"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="最大并发会话数" description="同时运行的最大会话数量">
          <Input
            type="number"
            min={1}
            max={100}
            value={numberVal("agents.defaults.maxConcurrent") ?? ""}
            onChange={(e) => setValue("agents.defaults.maxConcurrent", e.target.value ? Number(e.target.value) : undefined)}
            placeholder="10"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="人类延迟模式" description="模拟人类打字延迟">
          <select
            value={stringVal("agents.defaults.humanDelay.mode") || "off"}
            onChange={(e) => setValue("agents.defaults.humanDelay.mode", e.target.value)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="off">关闭</option>
            <option value="natural">自然延迟</option>
            <option value="custom">自定义</option>
          </select>
        </FieldRow>

        {stringVal("agents.defaults.humanDelay.mode") === "custom" && (
          <>
            <FieldRow label="最小延迟 (ms)">
              <Input
                type="number"
                min={0}
                value={numberVal("agents.defaults.humanDelay.minMs") ?? ""}
                onChange={(e) => setValue("agents.defaults.humanDelay.minMs", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="800"
                className="h-8 text-xs"
              />
            </FieldRow>
            <FieldRow label="最大延迟 (ms)">
              <Input
                type="number"
                min={0}
                value={numberVal("agents.defaults.humanDelay.maxMs") ?? ""}
                onChange={(e) => setValue("agents.defaults.humanDelay.maxMs", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="2500"
                className="h-8 text-xs"
              />
            </FieldRow>
          </>
        )}
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- 消息与命令 ---- */}
      <section>
        <SectionHeader icon={<MessageSquare className="w-4 h-4" />} title="消息与命令" />

        <FieldRow label="确认反应 Emoji" description="收到消息后的确认 Emoji">
          <Input
            value={stringVal("messages.ackReaction") || ""}
            onChange={(e) => setValue("messages.ackReaction", e.target.value)}
            placeholder="👀"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="原生命令" description="启用原生命令支持">
          <label className="flex items-center gap-2 cursor-pointer justify-end">
            <input
              type="checkbox"
              checked={boolVal("commands.native")}
              onChange={(e) => setValue("commands.native", e.target.checked)}
              className="rounded border-border-light"
            />
          </label>
        </FieldRow>

        <FieldRow label="允许 /config 命令" description="允许通过消息修改配置">
          <label className="flex items-center gap-2 cursor-pointer justify-end">
            <input
              type="checkbox"
              checked={boolVal("commands.config")}
              onChange={(e) => setValue("commands.config", e.target.checked)}
              className="rounded border-border-light"
            />
          </label>
        </FieldRow>

        <FieldRow label="允许 /debug 命令" description="启用调试命令">
          <label className="flex items-center gap-2 cursor-pointer justify-end">
            <input
              type="checkbox"
              checked={boolVal("commands.debug")}
              onChange={(e) => setValue("commands.debug", e.target.checked)}
              className="rounded border-border-light"
            />
          </label>
        </FieldRow>
      </section>

      {/* ---- 底部操作栏 ---- */}
      <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t border-border-light mt-6 flex items-center justify-between">
        {configError && (
          <p className="text-xs text-error flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {configError}
          </p>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!dirty || isSavingConfig}>
            重置
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || isSavingConfig}>
            {isSavingConfig ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                保存中...
              </>
            ) : (
              "保存设置"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Build a minimal patch from local form vs original config            */
/* ------------------------------------------------------------------ */

function buildPatch(
  form: Record<string, unknown>,
  original: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!original) return form;

  const patch: Record<string, unknown> = {};
  const topKeys = Array.from(new Set([...Object.keys(form), ...Object.keys(original)]));

  for (const key of topKeys) {
    const formVal = form[key];
    const origVal = original[key];
    if (JSON.stringify(formVal) !== JSON.stringify(origVal)) {
      patch[key] = formVal;
    }
  }

  return patch;
}
