"use client";

import { ChevronDown, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export interface SupplementItem {
  label: string;
  checked: boolean;
}

export interface SupplementInfoProps {
  title: string;
  status: "pending" | "confirmed";
  description?: string;
  sections: {
    title: string;
    items: SupplementItem[];
  }[];
  onConfirm?: () => void;
}

export function SupplementInfo({
  title,
  status,
  description,
  sections,
  onConfirm,
}: SupplementInfoProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mb-lg border border-border rounded-lg bg-surface overflow-hidden">
      {/* 头部 */}
      <div className="px-lg py-md border-b border-border-light bg-background-secondary">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-sm">
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            {status === "confirmed" && (
              <span className="flex items-center gap-xs text-xs text-success">
                <CheckCircle2 className="w-3 h-3" />
                已确认
              </span>
            )}
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-xs rounded hover:bg-background transition-colors text-text-tertiary"
            aria-label={isExpanded ? "折叠" : "展开"}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
        {description && <p className="text-sm text-text-secondary mt-xs">{description}</p>}
      </div>

      {/* 内容区 */}
      {isExpanded && (
        <div className="px-lg py-md">
          {sections.map((section, index) => (
            <div key={index} className={index > 0 ? "mt-lg" : ""}>
              <h4 className="text-sm font-medium text-text-secondary mb-sm">{section.title}</h4>
              <div className="space-y-xs">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-start gap-sm">
                    <div
                      className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded ${
                        item.checked
                          ? "bg-primary/10 border border-primary"
                          : "bg-background-secondary border border-border"
                      } flex items-center justify-center`}
                    >
                      {item.checked && <CheckCircle2 className="w-3 h-3 text-primary" />}
                    </div>
                    <span className="text-sm text-text-primary leading-relaxed">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {status === "pending" && onConfirm && (
            <div className="mt-lg pt-md border-t border-border-light">
              <button
                onClick={onConfirm}
                className="px-lg py-sm bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                确认方案
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
