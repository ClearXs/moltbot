"use client";

import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";
import { AgentStep } from "@/types/agent";

interface TodoListProps {
  steps: AgentStep[];
  currentStep?: AgentStep;
}

export function TodoList({ steps, currentStep }: TodoListProps) {
  if (steps.length === 0) {
    return (
      <div className="todo-list">
        <h3 className="text-lg font-medium text-gray-900 mb-4">执行计划</h3>
        <div className="text-center text-gray-500 py-8">暂无执行计划</div>
      </div>
    );
  }

  const getStatusIcon = (step: AgentStep) => {
    if (step.status === "completed") {
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    } else if (step.status === "running") {
      return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
    } else if (step.status === "failed") {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    return <Circle className="w-5 h-5 text-gray-300" />;
  };

  const getStepClass = (step: AgentStep) => {
    const baseClass = "flex items-start gap-3 p-3 rounded-lg transition-all duration-200";
    if (step.status === "running") {
      return `${baseClass} bg-blue-50 border border-blue-200`;
    } else if (step.status === "completed") {
      return `${baseClass} bg-green-50/50`;
    } else if (step.status === "failed") {
      return `${baseClass} bg-red-50/50`;
    }
    return `${baseClass} hover:bg-gray-50`;
  };

  return (
    <div className="todo-list">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">执行计划</h3>
        <span className="text-sm text-gray-500">
          {steps.filter((s) => s.status === "completed").length}/{steps.length} 步骤
        </span>
      </div>

      <div className="space-y-2">
        {steps.map((step, index) => (
          <div key={index} className={getStepClass(step)}>
            <div className="flex-shrink-0 mt-0.5">{getStatusIcon(step)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500">步骤 {step.step_number}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    step.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : step.status === "running"
                        ? "bg-blue-100 text-blue-700"
                        : step.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {step.status === "pending"
                    ? "等待执行"
                    : step.status === "running"
                      ? "执行中"
                      : step.status === "completed"
                        ? "已完成"
                        : "失败"}
                </span>
              </div>
              <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                {step.action || `步骤 ${step.step_number}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
