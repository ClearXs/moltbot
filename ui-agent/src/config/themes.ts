/**
 * Theme System Configuration
 *
 * Defines all available themes for the application.
 * Each theme has a unique identifier, display name, description, and preview colors.
 */

export type ThemeName =
  | "default"
  | "material-teal"
  | "warm-green"
  | "vibrant-multi"
  | "gray-minimal"
  | "dark-gray"
  | "manus-light";

export interface ThemeConfig {
  value: ThemeName;
  label: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string; // 第三个强调色,更好地展示主题特色
  };
}

export const THEMES: ThemeConfig[] = [
  {
    value: "default",
    label: "经典绿",
    description: "专业稳重 · 商务首选",
    colors: {
      primary: "#10a37f", // 青绿色
      secondary: "#34D399", // 翡翠绿(更鲜艳)
      accent: "#FBBF24", // 琥珀金
    },
  },
  {
    value: "material-teal",
    label: "海洋蓝",
    description: "清新冷静 · 科技感",
    colors: {
      primary: "#0EA5E9", // 天蓝色
      secondary: "#38BDF8", // 浅蓝
      accent: "#F97316", // 活力橙
    },
  },
  {
    value: "warm-green",
    label: "紫罗兰",
    description: "优雅高贵 · 创意灵感",
    colors: {
      primary: "#8B5CF6", // 紫色
      secondary: "#A78BFA", // 淡紫
      accent: "#EC4899", // 粉红
    },
  },
  {
    value: "vibrant-multi",
    label: "活力橙",
    description: "热情洋溢 · 充满能量",
    colors: {
      primary: "#F97316", // 橙色
      secondary: "#FB923C", // 珊瑚橙
      accent: "#FBBF24", // 金色
    },
  },
  {
    value: "gray-minimal",
    label: "灰白简约",
    description: "极简主义 · 高端内敛",
    colors: {
      primary: "#6B7280", // 中灰
      secondary: "#9CA3AF", // 浅灰
      accent: "#D1D5DB", // 极浅灰
    },
  },
  {
    value: "dark-gray",
    label: "黑灰暗色",
    description: "深邃优雅 · 专注护眼",
    colors: {
      primary: "#A8A29E", // 暖灰色 Stone 400
      secondary: "#78716C", // 中暖灰 Stone 500
      accent: "#57534E", // 深暖灰 Stone 600
    },
  },
  {
    value: "manus-light",
    label: "Manus亮色",
    description: "简约优雅 · 清新舒适",
    colors: {
      primary: "#34322d", // 深灰色
      secondary: "#858481", // 中灰
      accent: "#0081f2", // 蓝色强调
    },
  },
];

export const DEFAULT_THEME: ThemeName = "default";
