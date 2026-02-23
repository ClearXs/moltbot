"use client";

import { useEffect, useMemo, useState } from "react";

type TemplateCategory = "全部" | "运营" | "数据" | "文档" | "人事" | "客服" | "项目";

type TemplateItem = {
  title: string;
  category: TemplateCategory;
  description: string;
};

const CATEGORIES: TemplateCategory[] = ["全部", "运营", "数据", "文档", "人事", "客服", "项目"];

const RECOMMENDED_TEMPLATES: TemplateItem[] = [
  {
    title: "查看今日考勤情况",
    category: "人事",
    description: "点击快速开始",
  },
  {
    title: "分析本月销售数据",
    category: "数据",
    description: "点击快速开始",
  },
  {
    title: "生成投标文档",
    category: "文档",
    description: "点击快速开始",
  },
  {
    title: "查询公司资质",
    category: "运营",
    description: "点击快速开始",
  },
  {
    title: "生成周报总结",
    category: "运营",
    description: "点击快速开始",
  },
  {
    title: "本周运营数据概览",
    category: "数据",
    description: "点击快速开始",
  },
  {
    title: "客服问题分类汇总",
    category: "客服",
    description: "点击快速开始",
  },
  {
    title: "项目里程碑风险检查",
    category: "项目",
    description: "点击快速开始",
  },
];
const RECENT_STORAGE_KEY = "ui-agent.recentTemplates";

interface WelcomePageProps {
  onSelectPrompt: (prompt: string) => void;
  compact?: boolean;
  variant?: "chips" | "cards";
}

export function WelcomePage({
  onSelectPrompt,
  compact = false,
  variant = "chips",
}: WelcomePageProps) {
  const [recentTemplates, setRecentTemplates] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("全部");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return;
      setRecentTemplates(parsed.filter((item) => typeof item === "string"));
    } catch {
      // ignore
    }
  }, []);

  const sections = useMemo(() => {
    const filteredRecommended =
      activeCategory === "全部"
        ? RECOMMENDED_TEMPLATES
        : RECOMMENDED_TEMPLATES.filter((item) => item.category === activeCategory);
    const recentItems = recentTemplates
      .filter((item) => item && item !== "暂无最近记录")
      .map((title) => ({
        title,
        category: "运营" as TemplateCategory,
        description: "点击快速开始",
      }))
      .filter((item) => (activeCategory === "全部" ? true : item.category === activeCategory));
    return [
      {
        title: "推荐",
        items: filteredRecommended,
      },
      {
        title: "最近",
        items:
          recentItems.length > 0
            ? recentItems
            : [{ title: "暂无最近记录", category: "运营", description: "暂无记录" }],
        isEmpty: recentItems.length === 0,
      },
    ];
  }, [recentTemplates, activeCategory]);

  const handleSelect = (prompt: string) => {
    if (!prompt || prompt === "暂无最近记录") return;
    const next = [prompt, ...recentTemplates.filter((item) => item !== prompt)].slice(0, 6);
    setRecentTemplates(next);
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    onSelectPrompt(prompt);
  };

  return (
    <div className={`w-full ${compact ? "" : "text-center"}`}>
      {/* 标题 */}
      {!compact && (
        <>
          <h1 className="text-4xl font-bold text-text-primary mb-md">企业运营助手</h1>
          <p className="text-sm text-text-tertiary mb-2xl">
            选择一个示例开始对话,或直接输入您的需求
          </p>
        </>
      )}

      {/* 分类筛选 */}
      {variant === "cards" && (
        <div className="flex flex-wrap gap-xs mb-lg w-full">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              className={`px-sm py-xs rounded-full text-xs transition-colors ${
                activeCategory === category
                  ? "bg-primary/10 text-primary"
                  : "bg-background-secondary text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* 模板分组 */}
      <div className={`flex flex-col gap-lg w-full ${compact ? "items-start" : "items-center"}`}>
        {sections.map((section) => (
          <div
            key={section.title}
            className={`flex flex-col gap-xs w-full ${compact ? "items-start" : "items-center"}`}
          >
            <div className="flex items-center gap-sm w-full">
              <div className="text-xs font-medium text-text-secondary">{section.title}</div>
              {section.title === "最近" && recentTemplates.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRecentTemplates([]);
                    try {
                      localStorage.removeItem(RECENT_STORAGE_KEY);
                    } catch {
                      // ignore
                    }
                  }}
                  className="text-[10px] text-text-tertiary hover:text-primary underline-offset-2 hover:underline"
                >
                  清空最近
                </button>
              )}
            </div>
            {variant === "cards" ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-sm w-full">
                {section.items.map((item, index) => (
                  <button
                    key={`${section.title}-${index}`}
                    onClick={() => handleSelect(item.title)}
                    className={`
                      text-left rounded-xl border px-md py-sm transition-colors h-24
                      ${
                        section.isEmpty
                          ? "border-border-light bg-background-secondary/40 text-text-tertiary/70 cursor-default"
                          : "border-border-light bg-white hover:bg-primary/5 hover:border-primary/40 text-text-secondary"
                      }
                    `}
                    disabled={section.isEmpty}
                  >
                    <div className="text-sm font-medium truncate">{item.title}</div>
                    <div className="text-[11px] text-text-tertiary mt-1">{item.description}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div
                className={`flex flex-wrap gap-xs ${compact ? "" : "items-center justify-center"}`}
              >
                {section.items.map((item, index) => (
                  <button
                    key={`${section.title}-${index}`}
                    onClick={() => handleSelect(item.title)}
                    className={`text-xs transition-colors px-sm py-xs hover:underline ${
                      section.isEmpty
                        ? "text-text-tertiary/70 cursor-default"
                        : "text-text-tertiary hover:text-primary"
                    }`}
                    disabled={section.isEmpty}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
