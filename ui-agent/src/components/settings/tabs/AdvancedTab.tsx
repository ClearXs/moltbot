"use client";

import {
  Cog,
  Server,
  Clock,
  ScrollText,
  Activity,
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

function deepSet(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
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

export function AdvancedTab({ onClose }: { onClose?: () => void }) {
  const { config, isLoadingConfig, isSavingConfig, configError, loadConfig, patchConfig } =
    useSettingsStore();
  const { addToast } = useToastStore();

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);

  // Sync remote config to local form
  useEffect(() => {
    if (config) {
      setForm(config as Record<string, unknown>);
      setDirty(false);
    }
  }, [config]);

  const getValue = useCallback((path: string): unknown => deepGet(form, path), [form]);

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

  const handleSave = async () => {
    const patch = buildPatch(form, config as Record<string, unknown> | null);
    if (Object.keys(patch).length === 0) {
      addToast({ title: "无变更", description: "高级设置未发生变化" });
      return;
    }

    const result = await patchConfig(patch);
    if (result.ok) {
      setDirty(false);
      if (result.needsRestart) {
        addToast({
          title: "配置已保存，网关即将重启",
          description: "设置页面将关闭，请稍候重新打开",
        });
        setTimeout(() => {
          onClose?.();
        }, 1500);
      } else {
        addToast({
          title: "高级设置已保存",
          description: "设置已成功更新",
        });
      }
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

  if (isLoadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-text-tertiary animate-spin mb-3" />
        <p className="text-sm text-text-tertiary">加载高级设置...</p>
      </div>
    );
  }

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
      {/* ---- 顶部操作栏 ---- */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border-light">
        <div>
          {configError && (
            <p className="text-xs text-error flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {configError}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!dirty || isSavingConfig}
          >
            重置
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || isSavingConfig}>
            {isSavingConfig ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                保存中...
              </>
            ) : (
              "保存高级设置"
            )}
          </Button>
        </div>
      </div>

      {/* ---- Gateway 配置 ---- */}
      <section>
        <SectionHeader icon={<Server className="w-4 h-4" />} title="Gateway 配置" />

        <FieldRow label="监听端口" description="Gateway HTTP/WebSocket 监听端口">
          <Input
            type="number"
            min={1}
            max={65535}
            value={numberVal("gateway.port") ?? ""}
            onChange={(e) =>
              setValue("gateway.port", e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="18789"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="绑定地址" description="绑定网络接口,loopback 仅本地访问">
          <select
            value={stringVal("gateway.bind") || "loopback"}
            onChange={(e) => setValue("gateway.bind", e.target.value)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="loopback">Loopback (127.0.0.1)</option>
            <option value="tailscale">Tailscale</option>
            <option value="all">All (0.0.0.0)</option>
          </select>
        </FieldRow>

        <FieldRow label="配置重载模式" description="配置文件变更时的重载策略">
          <select
            value={stringVal("gateway.reload.mode") || "watch"}
            onChange={(e) => setValue("gateway.reload.mode", e.target.value)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="watch">监听文件变更</option>
            <option value="manual">手动重载</option>
            <option value="off">关闭</option>
          </select>
        </FieldRow>

        {stringVal("gateway.reload.mode") === "watch" && (
          <FieldRow label="重载防抖 (ms)" description="文件变更后等待多久再重载">
            <Input
              type="number"
              min={100}
              value={numberVal("gateway.reload.debounceMs") ?? ""}
              onChange={(e) =>
                setValue(
                  "gateway.reload.debounceMs",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="500"
              className="h-8 text-xs"
            />
          </FieldRow>
        )}
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- 会话管理 ---- */}
      <section>
        <SectionHeader icon={<Clock className="w-4 h-4" />} title="会话管理" />

        <FieldRow label="DM 会话作用域" description="DM 消息的会话隔离策略">
          <select
            value={stringVal("session.dmScope") || "main"}
            onChange={(e) => setValue("session.dmScope", e.target.value)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="main">Main (全局单会话)</option>
            <option value="per-peer">Per Peer (每个对话者)</option>
            <option value="per-channel-peer">Per Channel+Peer</option>
            <option value="per-account-channel-peer">Per Account+Channel+Peer</option>
          </select>
        </FieldRow>

        <FieldRow label="会话重置模式" description="自动重置会话上下文的策略">
          <select
            value={stringVal("session.reset.mode") || ""}
            onChange={(e) => setValue("session.reset.mode", e.target.value || undefined)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="">不自动重置</option>
            <option value="daily">每日定时重置</option>
            <option value="idle">空闲超时重置</option>
          </select>
        </FieldRow>

        {stringVal("session.reset.mode") === "daily" && (
          <FieldRow label="每日重置时间 (小时)" description="每天几点 (0-23) 重置会话">
            <Input
              type="number"
              min={0}
              max={23}
              value={numberVal("session.reset.atHour") ?? ""}
              onChange={(e) =>
                setValue(
                  "session.reset.atHour",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="4"
              className="h-8 text-xs"
            />
          </FieldRow>
        )}

        {stringVal("session.reset.mode") === "idle" && (
          <FieldRow label="空闲超时 (分钟)" description="多长时间无活动后重置会话">
            <Input
              type="number"
              min={1}
              value={numberVal("session.reset.idleMinutes") ?? ""}
              onChange={(e) =>
                setValue(
                  "session.reset.idleMinutes",
                  e.target.value ? Number(e.target.value) : undefined,
                )
              }
              placeholder="60"
              className="h-8 text-xs"
            />
          </FieldRow>
        )}
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- 日志配置 ---- */}
      <section>
        <SectionHeader icon={<ScrollText className="w-4 h-4" />} title="日志配置" />

        <FieldRow label="日志级别" description="文件日志记录级别">
          <select
            value={stringVal("logging.level") || "info"}
            onChange={(e) => setValue("logging.level", e.target.value)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </FieldRow>

        <FieldRow label="控制台日志级别" description="控制台输出的日志级别">
          <select
            value={stringVal("logging.consoleLevel") || ""}
            onChange={(e) => setValue("logging.consoleLevel", e.target.value || undefined)}
            className="h-8 w-full rounded-md border border-border-light bg-background px-2 text-xs"
          >
            <option value="">跟随文件日志级别</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </FieldRow>

        <FieldRow label="日志文件路径" description="日志文件保存位置">
          <Input
            value={stringVal("logging.file")}
            onChange={(e) => setValue("logging.file", e.target.value || undefined)}
            placeholder="/tmp/openclaw.log"
            className="h-8 text-xs font-mono"
          />
        </FieldRow>
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- 诊断与遥测 ---- */}
      <section>
        <SectionHeader icon={<Activity className="w-4 h-4" />} title="诊断与遥测" />

        <FieldRow label="启用诊断" description="开启诊断和遥测功能">
          <label className="flex items-center gap-2 cursor-pointer justify-end">
            <input
              type="checkbox"
              checked={boolVal("diagnostics.enabled")}
              onChange={(e) => setValue("diagnostics.enabled", e.target.checked)}
              className="rounded border-border-light"
            />
          </label>
        </FieldRow>

        <FieldRow label="启用 OpenTelemetry" description="启用 OTEL 追踪和指标收集">
          <label className="flex items-center gap-2 cursor-pointer justify-end">
            <input
              type="checkbox"
              checked={boolVal("diagnostics.otel.enabled")}
              onChange={(e) => setValue("diagnostics.otel.enabled", e.target.checked)}
              className="rounded border-border-light"
            />
          </label>
        </FieldRow>

        {boolVal("diagnostics.otel.enabled") && (
          <FieldRow label="OTEL Endpoint" description="OpenTelemetry 收集器地址">
            <Input
              value={stringVal("diagnostics.otel.endpoint")}
              onChange={(e) => setValue("diagnostics.otel.endpoint", e.target.value || undefined)}
              placeholder="http://localhost:4318"
              className="h-8 text-xs font-mono"
            />
          </FieldRow>
        )}
      </section>
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
  // Only diff the keys relevant to advanced settings
  const advancedKeys = ["gateway", "session", "logging", "diagnostics"];

  for (const key of advancedKeys) {
    const formVal = form[key];
    const origVal = original[key];
    if (JSON.stringify(formVal) !== JSON.stringify(origVal)) {
      patch[key] = formVal;
    }
  }

  return patch;
}
