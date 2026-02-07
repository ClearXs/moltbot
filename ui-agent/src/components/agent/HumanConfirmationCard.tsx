"use client";

import { FaUser, FaCheckCircle, FaClock } from "react-icons/fa";
import { HumanConfirmation } from "./StepItem";

interface HumanConfirmationCardProps {
  confirmation: HumanConfirmation;
  className?: string;
}

export function HumanConfirmationCard({
  confirmation,
  className = "",
}: HumanConfirmationCardProps) {
  const isWaiting = confirmation.status === "waiting";
  const isAnswered = confirmation.status === "answered";

  // 获取状态图标和标签
  const getStatusInfo = () => {
    if (isWaiting) {
      return {
        icon: <FaClock className="w-4 h-4 text-warning" />,
        label: "等待用户确认",
        labelColor: "text-warning",
      };
    }
    return {
      icon: <FaCheckCircle className="w-4 h-4 text-success" />,
      label: "用户已确认",
      labelColor: "text-success",
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`rounded-lg border border-border bg-background-tertiary p-md ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-md">
        <div className="flex items-center gap-sm">
          <FaUser className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-semibold text-text-primary">用户确认</span>
        </div>
        <div className="flex items-center gap-xs">
          {statusInfo.icon}
          <span className={`text-xs font-medium ${statusInfo.labelColor}`}>{statusInfo.label}</span>
        </div>
      </div>

      {/* 问题 */}
      <div className="mb-md">
        <p className="text-sm text-text-primary font-medium mb-sm">{confirmation.question}</p>
      </div>

      {/* 根据类型渲染不同的交互组件 */}
      {confirmation.type === "choice" && confirmation.options && (
        <div className="space-y-xs">
          <p className="text-xs text-text-secondary mb-sm">请选择一个或多个选项：</p>
          {confirmation.options.map((option, index) => (
            <label
              key={index}
              className={`flex items-start gap-sm p-sm rounded border ${
                option.checked ? "border-primary bg-background" : "border-border bg-background"
              } ${isWaiting ? "cursor-not-allowed opacity-60" : "cursor-default"}`}
            >
              <input
                type="checkbox"
                checked={option.checked || false}
                disabled
                className="mt-xs flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary">{option.label}</p>
                {option.value && option.value !== option.label && (
                  <p className="text-xs text-text-tertiary mt-xxs">{option.value}</p>
                )}
              </div>
              {option.checked && (
                <FaCheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-xs" />
              )}
            </label>
          ))}
        </div>
      )}

      {confirmation.type === "confirm" && (
        <div className="space-y-sm">
          <p className="text-xs text-text-secondary mb-sm">请确认是否继续：</p>
          {isAnswered && confirmation.userResponse && (
            <div className="flex items-center gap-sm p-sm rounded border border-border bg-background">
              <FaCheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success">
                用户选择：{confirmation.userResponse === "yes" ? "是，继续" : "否，取消"}
              </span>
            </div>
          )}
          {isWaiting && (
            <div className="flex gap-sm">
              <button
                disabled
                className="flex-1 px-md py-sm rounded bg-primary text-white text-sm font-medium opacity-60 cursor-not-allowed"
              >
                是，继续
              </button>
              <button
                disabled
                className="flex-1 px-md py-sm rounded border border-border bg-background text-text-secondary text-sm font-medium opacity-60 cursor-not-allowed"
              >
                否，取消
              </button>
            </div>
          )}
        </div>
      )}

      {confirmation.type === "input" && (
        <div className="space-y-sm">
          <p className="text-xs text-text-secondary mb-sm">请输入内容：</p>
          {isAnswered && confirmation.userResponse && (
            <div className="p-sm rounded border border-border bg-background">
              <p className="text-xs text-text-tertiary mb-xs">用户输入：</p>
              <p className="text-sm text-text-primary font-medium">{confirmation.userResponse}</p>
            </div>
          )}
          {isWaiting && (
            <input
              type="text"
              disabled
              placeholder="等待用户输入..."
              className="w-full px-sm py-sm rounded border border-border bg-background text-sm text-text-secondary opacity-60 cursor-not-allowed"
            />
          )}
        </div>
      )}

      {/* 时间戳 */}
      {confirmation.timestamp && (
        <div className="mt-md pt-sm border-t border-border">
          <p className="text-xs text-text-tertiary">
            {isWaiting ? "等待响应时间：" : "响应时间："}
            {new Date(confirmation.timestamp).toLocaleString("zh-CN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
