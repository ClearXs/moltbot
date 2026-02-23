"use client";

import {
  Book,
  Brain,
  Briefcase,
  Database,
  FileText,
  Folder,
  GraduationCap,
  Landmark,
  Lightbulb,
  Rocket,
  Scale,
  ScrollText,
  Shield,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import {
  FiArchive,
  FiBook,
  FiBookmark,
  FiBox,
  FiCpu,
  FiFileText,
  FiFolder,
  FiGrid,
  FiLayers,
  FiTag,
} from "react-icons/fi";
import { MdAutoStories, MdHub, MdInventory2, MdLibraryBooks, MdScience } from "react-icons/md";

type IconComponent = ComponentType<SVGProps<SVGSVGElement> | { size?: number; className?: string }>;

export type KnowledgeIconOption = {
  key: string;
  label: string;
  source: "lucide" | "react-icons";
  Icon: IconComponent;
};

const iconOptions: KnowledgeIconOption[] = [
  { key: "lucide:book", label: "书籍", source: "lucide", Icon: Book },
  { key: "lucide:database", label: "数据库", source: "lucide", Icon: Database },
  { key: "lucide:folder", label: "文件夹", source: "lucide", Icon: Folder },
  { key: "lucide:lightbulb", label: "灵感", source: "lucide", Icon: Lightbulb },
  { key: "lucide:shield", label: "合规", source: "lucide", Icon: Shield },
  { key: "lucide:file-text", label: "文档", source: "lucide", Icon: FileText },
  { key: "lucide:brain", label: "知识", source: "lucide", Icon: Brain },
  { key: "lucide:briefcase", label: "业务", source: "lucide", Icon: Briefcase },
  { key: "lucide:landmark", label: "政策", source: "lucide", Icon: Landmark },
  { key: "lucide:graduation-cap", label: "培训", source: "lucide", Icon: GraduationCap },
  { key: "lucide:rocket", label: "项目", source: "lucide", Icon: Rocket },
  { key: "lucide:scale", label: "法务", source: "lucide", Icon: Scale },
  { key: "lucide:scroll-text", label: "流程", source: "lucide", Icon: ScrollText },
  { key: "react-icons:fi:FiBook", label: "Fi Book", source: "react-icons", Icon: FiBook },
  { key: "react-icons:fi:FiFolder", label: "Fi Folder", source: "react-icons", Icon: FiFolder },
  {
    key: "react-icons:fi:FiFileText",
    label: "Fi FileText",
    source: "react-icons",
    Icon: FiFileText,
  },
  { key: "react-icons:fi:FiLayers", label: "Fi Layers", source: "react-icons", Icon: FiLayers },
  { key: "react-icons:fi:FiTag", label: "Fi Tag", source: "react-icons", Icon: FiTag },
  { key: "react-icons:fi:FiCpu", label: "Fi CPU", source: "react-icons", Icon: FiCpu },
  { key: "react-icons:fi:FiArchive", label: "Fi Archive", source: "react-icons", Icon: FiArchive },
  {
    key: "react-icons:fi:FiBookmark",
    label: "Fi Bookmark",
    source: "react-icons",
    Icon: FiBookmark,
  },
  { key: "react-icons:fi:FiGrid", label: "Fi Grid", source: "react-icons", Icon: FiGrid },
  { key: "react-icons:fi:FiBox", label: "Fi Box", source: "react-icons", Icon: FiBox },
  {
    key: "react-icons:md:MdLibraryBooks",
    label: "Md Library",
    source: "react-icons",
    Icon: MdLibraryBooks,
  },
  {
    key: "react-icons:md:MdAutoStories",
    label: "Md Stories",
    source: "react-icons",
    Icon: MdAutoStories,
  },
  { key: "react-icons:md:MdScience", label: "Md Science", source: "react-icons", Icon: MdScience },
  {
    key: "react-icons:md:MdInventory2",
    label: "Md Inventory",
    source: "react-icons",
    Icon: MdInventory2,
  },
  { key: "react-icons:md:MdHub", label: "Md Hub", source: "react-icons", Icon: MdHub },
];

const iconMap = new Map(iconOptions.map((item) => [item.key, item]));
const legacyKeyMap: Record<string, string> = {
  book: "lucide:book",
  database: "lucide:database",
  folder: "lucide:folder",
  lightbulb: "lucide:lightbulb",
  shield: "lucide:shield",
};

export function normalizeKnowledgeIconKey(icon?: string | null): string {
  if (!icon) return "lucide:book";
  const trimmed = icon.trim();
  if (!trimmed) return "lucide:book";
  const mapped = legacyKeyMap[trimmed];
  return mapped ?? trimmed;
}

export function getKnowledgeIconOptions(): KnowledgeIconOption[] {
  return iconOptions;
}

export function getKnowledgeIconOption(icon?: string | null): KnowledgeIconOption {
  const normalized = normalizeKnowledgeIconKey(icon);
  return iconMap.get(normalized) ?? iconMap.get("lucide:book")!;
}
