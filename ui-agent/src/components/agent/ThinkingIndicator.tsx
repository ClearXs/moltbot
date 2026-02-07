"use client";

import { Brain, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface ThinkingIndicatorProps {
  isThinking: boolean;
  status?: string;
  onToggle?: () => void;
  isExpanded?: boolean;
}

export function ThinkingIndicator({
  isThinking,
  status = "正在思考...",
  onToggle,
  isExpanded = true,
}: ThinkingIndicatorProps) {
  if (!isThinking) return null;

  return (
    <div className="thinking-indicator">
      {/* Header - Always visible */}
      <div
        className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-t-lg cursor-pointer hover:from-purple-100 hover:to-blue-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Brain className="w-5 h-5 text-purple-600" />
            <Sparkles className="w-3 h-3 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
          </div>
          <span className="text-sm font-medium text-purple-700">{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span
              className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          {onToggle &&
            (isExpanded ? (
              <ChevronUp className="w-4 h-4 text-purple-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-purple-400" />
            ))}
        </div>
      </div>
    </div>
  );
}

// Loading animation component
export function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <span
        className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
