"use client";

import { ChevronDown, Check } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ModelSelectorProps {
  currentModel: string;
  onChange: (model: string) => void;
}

const AVAILABLE_MODELS = [
  { id: "deepseek-v3.2", name: "DeepSeek-V3.2" },
  { id: "gpt-4", name: "GPT-4" },
  { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
];

export function ModelSelector({ currentModel, onChange }: ModelSelectorProps) {
  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === currentModel) || AVAILABLE_MODELS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-xs px-sm py-xs rounded-md hover:bg-surface-hover transition-colors duration-fast">
          <span className="text-sm font-medium text-text-primary">{selectedModel.name}</span>
          <ChevronDown className="w-3 h-3 text-text-secondary" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[180px]">
        {AVAILABLE_MODELS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onChange(model.id)}
            className="flex items-center justify-between"
          >
            <span>{model.name}</span>
            {model.id === currentModel && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
