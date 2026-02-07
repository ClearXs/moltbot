"use client";

import { FaDatabase, FaSearch, FaFile, FaGlobe } from "react-icons/fa";
import { RetrievalMetadata } from "./StepItem";

interface RetrievalBadgeProps {
  metadata: RetrievalMetadata;
  className?: string;
}

export function RetrievalBadge({ metadata, className = "" }: RetrievalBadgeProps) {
  // 根据来源选择图标
  const getSourceIcon = () => {
    switch (metadata.source) {
      case "knowledge_base":
        return <FaDatabase className="w-3 h-3" />;
      case "web":
        return <FaGlobe className="w-3 h-3" />;
      case "file":
        return <FaFile className="w-3 h-3" />;
    }
  };

  // 根据来源获取显示文本
  const getSourceLabel = () => {
    switch (metadata.source) {
      case "knowledge_base":
        return "知识库";
      case "web":
        return "网络";
      case "file":
        return "文件";
    }
  };

  // 相关度颜色（0-1映射到颜色）
  const getRelevanceColor = (relevance?: number) => {
    if (!relevance) return "text-text-tertiary";
    if (relevance >= 0.8) return "text-success";
    if (relevance >= 0.6) return "text-primary";
    return "text-warning";
  };

  // 格式化相关度百分比
  const formatRelevance = (relevance?: number) => {
    if (!relevance) return null;
    return `${Math.round(relevance * 100)}%`;
  };

  return (
    <div className={`inline-flex items-center gap-xs ${className}`}>
      {/* 来源标签 */}
      <span className="inline-flex items-center gap-xs px-sm py-xs bg-background-secondary text-text-secondary rounded text-xs font-medium border border-border">
        {getSourceIcon()}
        {getSourceLabel()}
      </span>

      {/* 搜索图标 */}
      <FaSearch className="w-3 h-3 text-text-tertiary" />

      {/* 查询内容（如果有） */}
      {metadata.query && (
        <span className="text-xs text-text-secondary max-w-[200px] truncate">
          "{metadata.query}"
        </span>
      )}

      {/* 匹配数量 */}
      {metadata.matches !== undefined && (
        <span className="text-xs text-text-secondary">
          找到 <span className="font-semibold text-primary">{metadata.matches}</span> 条相关
        </span>
      )}

      {/* 相关度 */}
      {metadata.relevance !== undefined && (
        <span className={`text-xs font-semibold ${getRelevanceColor(metadata.relevance)}`}>
          相关度 {formatRelevance(metadata.relevance)}
        </span>
      )}
    </div>
  );
}
