"use client";

import {
  Palette,
  Check,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  RefreshCcw,
  Copy,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { THEMES, type ThemeName } from "@/config/themes";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";

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
/*  Theme card                                                           */
/* ------------------------------------------------------------------ */

function ThemeCard({
  theme,
  isSelected,
  onSelect,
}: {
  theme: (typeof THEMES)[number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start p-3 rounded-lg border-2 transition-all text-left w-full",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border-light hover:border-text-tertiary",
      )}
    >
      {/* Color preview dots */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-4 h-4 rounded-full border border-white/20"
          style={{ backgroundColor: theme.colors.primary }}
        />
        <span
          className="w-4 h-4 rounded-full border border-white/20"
          style={{ backgroundColor: theme.colors.secondary }}
        />
        {theme.colors.accent && (
          <span
            className="w-4 h-4 rounded-full border border-white/20"
            style={{ backgroundColor: theme.colors.accent }}
          />
        )}
      </div>

      {/* Name & description */}
      <div className="text-sm font-medium text-text-primary">{theme.label}</div>
      <div className="text-xs text-text-tertiary mt-0.5">{theme.description}</div>

      {/* Selected check */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                       */
/* ------------------------------------------------------------------ */

export function AppearanceTab() {
  const { theme, setTheme } = useThemeStore();
  const { config, isLoadingConfig, isSavingConfig, configError, loadConfig, patchConfig } =
    useSettingsStore();
  const { addToast } = useToastStore();

  // Local state for UI customization fields
  const [seamColor, setSeamColor] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [assistantAvatar, setAssistantAvatar] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync from config
  useEffect(() => {
    if (config) {
      setSeamColor(config.ui?.seamColor ?? "");
      setAssistantName(config.ui?.assistant?.name ?? "");
      setAssistantAvatar(config.ui?.assistant?.avatar ?? "");
      setDirty(false);
    }
  }, [config]);

  const handleSave = async () => {
    const patch: Record<string, unknown> = {};
    const uiPatch: Record<string, unknown> = {};

    if (seamColor !== (config?.ui?.seamColor ?? "")) {
      uiPatch.seamColor = seamColor || undefined;
    }

    const assistantPatch: Record<string, unknown> = {};
    if (assistantName !== (config?.ui?.assistant?.name ?? "")) {
      assistantPatch.name = assistantName || undefined;
    }
    if (assistantAvatar !== (config?.ui?.assistant?.avatar ?? "")) {
      assistantPatch.avatar = assistantAvatar || undefined;
    }
    if (Object.keys(assistantPatch).length > 0) {
      uiPatch.assistant = assistantPatch;
    }

    if (Object.keys(uiPatch).length === 0) {
      addToast({ title: "无变更", description: "外观设置未发生变化" });
      return;
    }

    patch.ui = uiPatch;
    const result = await patchConfig(patch);
    if (result.ok) {
      setDirty(false);
      addToast({
        title: "外观设置已保存",
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
      setSeamColor(config.ui?.seamColor ?? "");
      setAssistantName(config.ui?.assistant?.name ?? "");
      setAssistantAvatar(config.ui?.assistant?.avatar ?? "");
      setDirty(false);
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-text-tertiary animate-spin mb-3" />
        <p className="text-sm text-text-tertiary">加载外观设置...</p>
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
      {/* ---- Theme selection ---- */}
      <section>
        <SectionHeader icon={<Palette className="w-4 h-4" />} title="主题选择" />
        <p className="text-xs text-text-tertiary mb-4">
          选择一个预设主题,立即应用到整个界面。
        </p>
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.value}
              theme={t}
              isSelected={theme === t.value}
              onSelect={() => setTheme(t.value)}
            />
          ))}
        </div>
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- Custom accent color ---- */}
      <section>
        <SectionHeader icon={<Palette className="w-4 h-4" />} title="自定义强调色" />

        <FieldRow label="主题强调色" description="覆盖当前主题的主色调,应用于按钮和高亮元素">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={seamColor || "#6366f1"}
              onChange={(e) => {
                setSeamColor(e.target.value);
                setDirty(true);
              }}
              className="w-8 h-8 rounded border border-border-light cursor-pointer"
            />
            <Input
              value={seamColor}
              onChange={(e) => {
                setSeamColor(e.target.value);
                setDirty(true);
              }}
              placeholder="#6366f1"
              className="h-8 text-xs flex-1"
            />
            {seamColor && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-text-tertiary"
                onClick={() => {
                  setSeamColor("");
                  setDirty(true);
                }}
              >
                清除
              </Button>
            )}
          </div>
        </FieldRow>
      </section>

      <hr className="border-border-light my-5" />

      {/* ---- Assistant identity ---- */}
      <section>
        <SectionHeader icon={<Palette className="w-4 h-4" />} title="助手身份" />

        <FieldRow label="助手名称" description="助手在对话中显示的名称">
          <Input
            value={assistantName}
            onChange={(e) => {
              setAssistantName(e.target.value);
              setDirty(true);
            }}
            placeholder="Assistant"
            className="h-8 text-xs"
          />
        </FieldRow>

        <FieldRow label="助手头像" description="支持 Emoji、短文本或图片 URL">
          <Input
            value={assistantAvatar}
            onChange={(e) => {
              setAssistantAvatar(e.target.value);
              setDirty(true);
            }}
            placeholder="🤖 或 图片 URL"
            className="h-8 text-xs"
          />
        </FieldRow>

        {/* Avatar preview */}
        {assistantAvatar && (
          <div className="flex items-center gap-3 py-3">
            <div className="text-sm text-text-tertiary">预览:</div>
            <div className="w-10 h-10 rounded-full bg-surface-subtle flex items-center justify-center overflow-hidden border border-border-light">
              {assistantAvatar.startsWith("http") || assistantAvatar.startsWith("data:") ? (
                <img
                  src={assistantAvatar}
                  alt="avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-lg">{assistantAvatar}</span>
              )}
            </div>
            <span className="text-sm text-text-primary">
              {assistantName || "Assistant"}
            </span>
          </div>
        )}
      </section>

      {/* ---- Save bar ---- */}
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
              "保存外观设置"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
