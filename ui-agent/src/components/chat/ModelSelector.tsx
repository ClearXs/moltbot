"use client";

import { ChevronDown, Check, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSettingsStore } from "@/stores/settingsStore";

interface ModelSelectorProps {
  currentModel: string;
  onChange: (model: string) => void;
}

interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
}

export function ModelSelector({ currentModel, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const config = useSettingsStore((s) => s.config);

  useEffect(() => {
    const loadModels = () => {
      if (!config) {
        setIsLoading(false);
        return;
      }
      const modelsProviders = (
        config.models as
          | Record<string, { models?: Array<{ id: string; name: string }> }>
          | undefined
      )?.providers;

      if (modelsProviders) {
        const loadedModels: ModelInfo[] = [];
        const providerWithModels = modelsProviders as Record<
          string,
          { models?: Array<{ id: string; name?: string }> }
        >;
        Object.entries(providerWithModels).forEach(([providerName, provider]) => {
          if (provider?.models) {
            provider.models.forEach((model) => {
              loadedModels.push({
                id: model.id,
                name: model.name || model.id,
                provider: providerName,
              });
            });
          }
        });
        setModels(loadedModels);
      }
      setIsLoading(false);
    };
    loadModels();
  }, [config]);

  const selectedModel = models.find((m) => m.id === currentModel);

  // 如果没有加载到模型，显示默认选项
  const displayName = isLoading ? "加载中..." : selectedModel?.name || currentModel || "选择模型";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-xs px-sm py-xs rounded-md hover:bg-surface-hover transition-colors duration-fast">
          {isLoading && <Loader2 className="w-3 h-3 text-text-secondary animate-spin" />}
          <span className="text-sm font-medium text-text-primary">{displayName}</span>
          <ChevronDown className="w-3 h-3 text-text-secondary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[180px]">
        {models.length === 0 && !isLoading ? (
          <DropdownMenuItem disabled className="text-text-tertiary">
            暂无可用模型
          </DropdownMenuItem>
        ) : (
          models.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onChange(model.id)}
              className="flex items-center justify-between"
            >
              <div className="flex flex-col">
                <span>{model.name}</span>
                {model.provider && (
                  <span className="text-[10px] text-text-tertiary">{model.provider}</span>
                )}
              </div>
              {model.id === currentModel && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
