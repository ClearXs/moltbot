"use client";

import { BarChart, Database, FileText, Terminal } from "lucide-react";
import { useAgentStore } from "@/stores/agentStore";
import { ToolUsage } from "@/types";

interface ToolDisplayItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  usageCount: number;
  color: string;
}

// Helper functions for converting tool data to display format
const getToolIcon = (toolName: string): string => {
  if (toolName.toLowerCase().includes("python")) return "🐍";
  if (toolName.toLowerCase().includes("pandas")) return "📊";
  if (toolName.toLowerCase().includes("chart") || toolName.toLowerCase().includes("plot"))
    return "📈";
  if (toolName.toLowerCase().includes("pdf")) return "📄";
  return "🔧";
};

const getToolColor = (index: number): string => {
  const colors = ["blue", "green", "purple", "yellow"];
  return colors[index % colors.length];
};

const UsedTools = () => {
  const agent = useAgentStore((state) => state.agent);

  // Convert store tools to display format or show demo data
  const displayTools: ToolDisplayItem[] = agent?.usedTools?.length
    ? agent.usedTools.map((tool, index) => ({
        id: tool.id,
        name: tool.name,
        icon: getToolIcon(tool.name),
        description: tool.description,
        usageCount: 1,
        color: getToolColor(index),
      }))
    : [
        {
          id: "1",
          name: "Python 3.11",
          icon: "🐍",
          description: "代码执行环境",
          usageCount: 5,
          color: "blue",
        },
        {
          id: "2",
          name: "Pandas",
          icon: "📊",
          description: "数据处理",
          usageCount: 23,
          color: "green",
        },
        {
          id: "3",
          name: "Matplotlib",
          icon: "📈",
          description: "数据可视化",
          usageCount: 8,
          color: "purple",
        },
        {
          id: "4",
          name: "FPDF",
          icon: "📄",
          description: "PDF 生成",
          usageCount: 1,
          color: "yellow",
        },
      ];

  const getColorStyles = (color: string) => {
    const styles = {
      blue: "bg-blue-100 text-blue-600 border-blue-200",
      green: "bg-green-100 text-green-600 border-green-200",
      purple: "bg-purple-100 text-purple-600 border-purple-200",
      yellow: "bg-yellow-100 text-yellow-600 border-yellow-200",
    };
    return styles[color as keyof typeof styles] || styles.blue;
  };

  const getIcon = (icon: string) => {
    switch (icon) {
      case "🐍":
        return <Terminal className="w-5 h-5" />;
      case "📊":
        return <Database className="w-5 h-5" />;
      case "📈":
        return <BarChart className="w-5 h-5" />;
      case "📄":
        return <FileText className="w-5 h-5" />;
      default:
        return <Terminal className="w-5 h-5" />;
    }
  };

  return (
    <div>
      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        使用的工具
      </h4>
      <div className="space-y-2">
        {displayTools.map((tool) => (
          <div
            key={tool.id}
            className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer hover:shadow-sm tool-card ${getColorStyles(tool.color)}`}
          >
            <div className="w-8 h-8 bg-white/50 rounded-lg flex items-center justify-center">
              {getIcon(tool.icon)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{tool.name}</p>
              <p className="text-xs text-gray-500">{tool.description}</p>
            </div>
            <span className="px-2 py-0.5 bg-white/50 rounded text-xs font-medium">
              {tool.usageCount}次
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UsedTools;
