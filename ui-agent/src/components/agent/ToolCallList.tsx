"use client";

import { FaTools, FaCheck, FaSpinner, FaTimes } from "react-icons/fa";
import { ToolCall } from "./StepItem";

interface ToolCallListProps {
  toolCalls: ToolCall[];
  className?: string;
}

/**
 * 并行工具调用列表组件
 *
 * 显示方式：与 detail 项相同的样式
 * - 每个工具调用显示为一个卡片
 * - 包含工具名称标签（如 🔧 创建文件）
 * - 显示操作描述、URL、执行结果
 * - 与 StepItem 中的 action detail 样式保持一致
 */
export function ToolCallList({ toolCalls, className = "" }: ToolCallListProps) {
  // 获取状态图标
  const getStatusIcon = (status: ToolCall["status"]) => {
    switch (status) {
      case "pending":
        return <div className="w-3 h-3 rounded-full border-2 border-text-tertiary" />;
      case "running":
        return <FaSpinner className="w-3 h-3 text-primary animate-spin" />;
      case "success":
        return <FaCheck className="w-3 h-3 text-success" />;
      case "failed":
        return <FaTimes className="w-3 h-3 text-error" />;
    }
  };

  return (
    <div className={`space-y-sm ${className}`}>
      {toolCalls.map((call) => (
        <div
          key={call.id}
          className="rounded-lg bg-background-tertiary px-md py-sm border border-border-light"
        >
          {/* 工具名称标签（与 StepItem 的 action detail 样式一致） */}
          <div className="flex items-center gap-xs mb-xs">
            <span className="inline-flex items-center gap-xs px-sm py-xs bg-background text-text-secondary rounded text-xs font-medium border border-border">
              <FaTools className="w-3 h-3" />
              {call.tool}
            </span>
            {/* 状态图标 */}
            {getStatusIcon(call.status)}
          </div>

          {/* 操作描述 */}
          <div className="text-xs text-text-primary leading-relaxed">{call.action}</div>

          {/* URL - 如果有的话 */}
          {call.url && (
            <a
              href={call.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline break-all mt-xs block"
            >
              {call.url}
            </a>
          )}

          {/* 结果 - 成功时显示（只用文字颜色，无背景） */}
          {call.result && call.status === "success" && (
            <p className="text-xs text-success mt-xs">✓ {call.result}</p>
          )}

          {/* 错误 - 失败时显示（只用文字颜色，无背景） */}
          {call.result && call.status === "failed" && (
            <p className="text-xs text-error mt-xs">✗ {call.result}</p>
          )}
        </div>
      ))}
    </div>
  );
}
