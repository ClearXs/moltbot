"use client";

import {
  Plus,
  MessageSquare,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Filter,
  Settings,
  Info,
  ArrowLeft,
  MoreHorizontal,
  Trash2,
  Check,
  X,
  TrendingUp,
  ListChecks,
  Mail,
  Compass,
  Puzzle,
  Target,
  Gem,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FiEdit3, FiSearch, FiBook } from "react-icons/fi";
import type { GatewaySessionRow } from "@/types/clawdbot";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import appMeta from "../../../package.json";

interface SidebarProps {
  sessions?: GatewaySessionRow[];
  unreadMap?: Record<string, boolean>;
  currentSessionKey?: string | null;
  onSelectSession?: (key: string) => void;
  onNewSession?: () => void;
  onRenameSession?: (key: string) => void;
  onDeleteSession?: (key: string) => void;
  onViewSession?: (key: string) => void;
  searchQuery?: string;
  filterKind?: "all" | "direct" | "group" | "global" | "unknown";
  onSearchChange?: (value: string) => void;
  onFilterChange?: (value: SidebarProps["filterKind"]) => void;
  unreadOnly?: boolean;
  onUnreadToggle?: (value: boolean) => void;
  sortMode?: "recent" | "name";
  onSortChange?: (value: SidebarProps["sortMode"]) => void;
  selectionMode?: boolean;
  selectedKeys?: string[];
  onToggleSelectionMode?: () => void;
  onToggleSelectedKey?: (key: string) => void;
  onSelectAllKeys?: (keys: string[]) => void;
  onClearSelection?: () => void;
  onBatchDelete?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isLoading?: boolean;
  onOpenKnowledge?: () => void;
  activeMainView?: "chat" | "knowledge";
}

const Sidebar = ({
  sessions = [],
  unreadMap = {},
  currentSessionKey = null,
  onSelectSession = () => {},
  onNewSession = () => {},
  onRenameSession = () => {},
  onDeleteSession = () => {},
  onViewSession = () => {},
  searchQuery = "",
  filterKind = "all",
  onSearchChange = () => {},
  onFilterChange = () => {},
  unreadOnly = false,
  onUnreadToggle = () => {},
  sortMode = "recent",
  onSortChange = () => {},
  selectionMode = false,
  selectedKeys = [],
  onToggleSelectionMode = () => {},
  onToggleSelectedKey = () => {},
  onSelectAllKeys = () => {},
  onClearSelection = () => {},
  onBatchDelete = () => {},
  isCollapsed = false,
  onToggleCollapse = () => {},
  isLoading = false,
  onOpenKnowledge = () => {},
  activeMainView = "chat",
}: SidebarProps) => {
  // 任务列表收缩状态
  const [isTasksExpanded, setIsTasksExpanded] = useState(true);
  // 品牌图标悬停状态（用于收起时显示返回箭头）
  const [isHoveringBrand, setIsHoveringBrand] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { openSettings } = useSettingsStore();
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const lastSessionKeysRef = useRef<string[]>([]);
  const sessionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Mock functions for search and library
  const handleSearchClick = () => {
    // no-op: search is handled inline
  };

  const handleLibraryClick = () => {
    onOpenKnowledge();
  };

  const resolveTitle = (session: GatewaySessionRow) =>
    session.label || session.derivedTitle || session.displayName || "新建对话";

  const resolveUpdatedAt = (session: GatewaySessionRow) => {
    if (!session.updatedAt) return "—";
    return new Date(session.updatedAt).toLocaleString("zh-CN", { hour12: false });
  };

  useEffect(() => {
    if (!scrollAreaRef.current) return;
    viewportRef.current = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleScroll = () => {
      lastScrollTopRef.current = viewport.scrollTop;
    };
    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const nextKeys = sessions.map((session) => session.key);
    if (nextKeys.join("|") === lastSessionKeysRef.current.join("|")) return;
    lastSessionKeysRef.current = nextKeys;
    requestAnimationFrame(() => {
      viewport.scrollTop = lastScrollTopRef.current;
    });
  }, [sessions]);

  useEffect(() => {
    if (!currentSessionKey) return;
    const node = sessionRefs.current[currentSessionKey];
    if (!node) return;
    node.scrollIntoView({ block: "nearest" });
  }, [currentSessionKey, sessions]);

  const isAllSelected = sessions.length > 0 && selectedKeys.length === sessions.length;
  const aboutDialog = (
    <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>关于企业运营助手</DialogTitle>
        </DialogHeader>
        <div className="space-y-md text-sm text-text-secondary">
          <div>
            企业运营助手是面向企业运营场景的对话式工作台，你可以在这里创建任务、组织信息，并把日常流程
            变成可追踪的对话。
          </div>
          <div className="grid grid-cols-1 gap-sm">
            <div className="flex items-center justify-between rounded-md border border-border-light px-sm py-xs">
              <span className="text-text-tertiary">版本</span>
              <span className="text-text-primary">{appMeta.version}</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border-light px-sm py-xs">
              <span className="text-text-tertiary">作者</span>
              <span className="text-text-primary">jiangwei</span>
            </div>
          </div>
          <div>
            <div className="text-text-tertiary text-xs mb-xs flex items-center gap-xs">
              <Puzzle className="w-3.5 h-3.5" />
              <span>如何使用</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1">
              <li>点击“新建任务”，进入模板页或直接输入你的需求。</li>
              <li>选择模板会自动填充输入框，你可以修改后再发送。</li>
              <li>发送后生成一个对话，所有过程与结果都会保留在会话内。</li>
              <li>左侧可搜索、筛选、排序和管理会话，保持任务清晰。</li>
            </ol>
          </div>
          <div>
            <div className="text-text-tertiary text-xs mb-xs flex items-center gap-xs">
              <Target className="w-3.5 h-3.5" />
              <span>适用场景</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>日常运营任务：考勤、日报、数据汇总</li>
              <li>跨团队协作：需求跟进、问题排查、流程记录</li>
              <li>知识组织：把临时讨论沉淀为可复用的任务与记录</li>
            </ul>
          </div>
          <div>
            <div className="text-text-tertiary text-xs mb-xs flex items-center gap-xs">
              <Gem className="w-3.5 h-3.5" />
              <span>核心价值</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>统一入口：任务、沟通、结果集中在一个对话里</li>
              <li>过程可见：工具调用与关键步骤清晰呈现</li>
              <li>可追踪复盘：每个任务都可回溯与复用</li>
            </ul>
          </div>
          <div>
            <div className="text-text-tertiary text-xs mb-xs flex items-center gap-xs">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>FAQ</span>
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-text-primary">是否必须用模板？</div>
                <div>不需要。模板是快捷入口，你可以直接输入需求。</div>
              </div>
              <div>
                <div className="text-text-primary">一条任务会拆成多个对话吗？</div>
                <div>不会。一次发送会聚合为一个完整对话气泡。</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-text-tertiary text-xs mb-xs flex items-center gap-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>隐私说明</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>仅在你发起任务时处理内容，不做公开展示。</li>
              <li>会话记录用于任务追踪与复盘，你可随时删除。</li>
              <li>请勿输入敏感信息，避免不必要的风险。</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (isCollapsed) {
    return (
      <>
        {aboutDialog}
        <aside
          className="h-full bg-sidebar transition-all duration-base flex flex-col"
          style={{ width: "var(--sidebar-collapsed-width)" }}
        >
          {/* 品牌标识 - 收起状态（悬停显示返回图标） */}
          <div className="p-md flex justify-center flex-shrink-0">
            <div
              onMouseEnter={() => setIsHoveringBrand(true)}
              onMouseLeave={() => setIsHoveringBrand(false)}
              onClick={onToggleCollapse}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-fast hover:bg-surface-hover overflow-hidden cursor-pointer"
              title="展开侧边栏"
            >
              {isHoveringBrand ? (
                <ArrowLeft className="w-5 h-5 text-text-secondary rotate-180" />
              ) : (
                <Image
                  src="/img/logo.png"
                  alt="Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>

          {/* 新建任务按钮 */}
          <div className="flex flex-col items-center pt-lg gap-md flex-shrink-0">
            <button
              onClick={onNewSession}
              className={cn(
                "w-10 h-10 rounded-md flex items-center justify-center transition-colors duration-fast",
                activeMainView === "chat" ? "bg-primary/10" : "hover:bg-surface-hover",
              )}
              title="新建任务"
            >
              <Plus
                className={cn(
                  "w-5 h-5",
                  activeMainView === "chat" ? "text-primary" : "text-text-secondary",
                )}
              />
            </button>
          </div>

          {/* 搜索按钮 */}
          <div className="flex flex-col items-center gap-md flex-shrink-0">
            <button
              onClick={handleSearchClick}
              className="w-10 h-10 rounded-md hover:bg-surface-hover flex items-center justify-center transition-colors duration-fast"
              title="搜索"
            >
              <FiSearch className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* 知识库按钮 */}
          <div className="flex flex-col items-center gap-md flex-shrink-0">
            <button
              onClick={handleLibraryClick}
              className={cn(
                "w-10 h-10 rounded-md flex items-center justify-center transition-colors duration-fast",
                activeMainView === "knowledge" ? "bg-primary/10" : "hover:bg-surface-hover",
              )}
              title="知识库"
            >
              <FiBook
                className={cn(
                  "w-5 h-5",
                  activeMainView === "knowledge" ? "text-primary" : "text-text-secondary",
                )}
              />
            </button>
          </div>

          {/* 占位符 - 撑开空间 */}
          <div className="flex-1" />

          {/* 底部功能区 */}
          <div className="flex flex-col items-center gap-md p-md flex-shrink-0">
            {/* 设置按钮 */}
            <button
              onClick={() => openSettings()}
              className="w-10 h-10 rounded-md hover:bg-surface-hover flex items-center justify-center transition-colors duration-fast"
              title="设置"
            >
              <Settings className="w-4 h-4 text-text-tertiary" />
            </button>

            {/* 关于按钮 */}
            <button
              className="w-10 h-10 rounded-md hover:bg-surface-hover flex items-center justify-center transition-colors duration-fast"
              title="关于企业运营助手"
              onClick={() => setAboutOpen(true)}
            >
              <Info className="w-4 h-4 text-text-tertiary" />
            </button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      {aboutDialog}
      <aside
        className="h-full bg-sidebar transition-all duration-base flex flex-col"
        style={{ width: "var(--sidebar-width)" }}
      >
        {/* 品牌标识 - 展开状态（折叠按钮在右侧） */}
        <div className="p-lg flex-shrink-0">
          <div className="flex items-center justify-between gap-sm">
            <div className="flex items-center gap-sm flex-1 min-w-0">
              <Image
                src="/img/logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="w-8 h-8 rounded-md object-contain flex-shrink-0"
              />
              <h1 className="text-base font-semibold text-text-primary">企业运营助手</h1>
            </div>
            {/* 折叠按钮 */}
            <button
              onClick={onToggleCollapse}
              className="w-6 h-6 rounded hover:bg-surface-hover flex items-center justify-center transition-colors duration-fast text-text-tertiary flex-shrink-0"
              title="折叠侧边栏"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 顶部功能选项列表 */}
        <div className="flex-shrink-0">
          {/* 新建任务 */}
          <button
            onClick={onNewSession}
            className={cn(
              "w-full flex items-center gap-sm px-lg py-sm transition-colors",
              activeMainView === "chat" ? "bg-primary/10" : "hover:bg-background-secondary",
            )}
          >
            <FiEdit3
              className={cn(
                "w-4 h-4 flex-shrink-0",
                activeMainView === "chat" ? "text-primary" : "text-text-secondary",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                activeMainView === "chat" ? "text-text-primary" : "text-text-secondary",
              )}
            >
              新建任务
            </span>
          </button>

          {/* 搜索 */}
          <button
            onClick={handleSearchClick}
            className="w-full flex items-center gap-sm px-lg py-sm hover:bg-background-secondary transition-colors"
          >
            <FiSearch className="w-4 h-4 text-text-secondary flex-shrink-0" />
            <span className="text-xs font-medium text-text-secondary">搜索</span>
          </button>

          {/* 知识库 */}
          <button
            onClick={handleLibraryClick}
            className={cn(
              "w-full flex items-center gap-sm px-lg py-sm transition-colors",
              activeMainView === "knowledge" ? "bg-primary/10" : "hover:bg-background-secondary",
            )}
          >
            <FiBook
              className={cn(
                "w-4 h-4 flex-shrink-0",
                activeMainView === "knowledge" ? "text-primary" : "text-text-secondary",
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                activeMainView === "knowledge" ? "text-text-primary" : "text-text-secondary",
              )}
            >
              知识库
            </span>
          </button>
        </div>

        {/* 对话列表 - 顶部有border和间距 */}
        <div className="flex-1 overflow-hidden border-t border-border-light mt-sm pt-md flex flex-col">
          {/* 任务列表标题栏 */}
          <div className="flex items-center justify-between px-lg pb-sm flex-shrink-0">
            <button
              onClick={() => setIsTasksExpanded(!isTasksExpanded)}
              className="flex items-center gap-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              {isTasksExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <span className="text-xs font-medium">所有任务</span>
            </button>
            <div className="flex items-center gap-xs">
              <button
                className={cn(
                  "p-1 rounded transition-colors",
                  unreadOnly
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-hover text-text-tertiary",
                )}
                onClick={() => onUnreadToggle(!unreadOnly)}
                title="只看未读"
              >
                <Mail className="w-3.5 h-3.5" />
              </button>
              <button
                className="p-1 rounded hover:bg-surface-hover transition-colors"
                title={selectionMode ? "退出批量" : "批量管理"}
                onClick={onToggleSelectionMode}
              >
                {selectionMode ? (
                  <X className="w-3.5 h-3.5 text-text-tertiary" />
                ) : (
                  <ListChecks className="w-3.5 h-3.5 text-text-tertiary" />
                )}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded hover:bg-surface-hover transition-colors"
                    title="排序"
                  >
                    <TrendingUp
                      className={cn(
                        "w-3.5 h-3.5",
                        sortMode !== "recent" ? "text-primary" : "text-text-tertiary",
                      )}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSortChange("recent")}>
                    <span className="mr-2 inline-flex w-3.5 h-3.5 items-center justify-center">
                      {sortMode === "recent" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <span className={sortMode === "recent" ? "text-primary" : undefined}>
                      最近活动
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSortChange("name")}>
                    <span className="mr-2 inline-flex w-3.5 h-3.5 items-center justify-center">
                      {sortMode === "name" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <span className={sortMode === "name" ? "text-primary" : undefined}>名称</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded hover:bg-surface-hover transition-colors"
                    title="过滤"
                  >
                    <Filter
                      className={cn(
                        "w-3.5 h-3.5",
                        filterKind !== "all" ? "text-primary" : "text-text-tertiary",
                      )}
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onFilterChange("all")}>
                    <span className="mr-2 inline-flex w-3.5 h-3.5 items-center justify-center">
                      {filterKind === "all" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <span className={filterKind === "all" ? "text-primary" : undefined}>全部</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFilterChange("direct")}>
                    <span className="mr-2 inline-flex w-3.5 h-3.5 items-center justify-center">
                      {filterKind === "direct" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <span className={filterKind === "direct" ? "text-primary" : undefined}>
                      私聊
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFilterChange("group")}>
                    <span className="mr-2 inline-flex w-3.5 h-3.5 items-center justify-center">
                      {filterKind === "group" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <span className={filterKind === "group" ? "text-primary" : undefined}>
                      群组
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFilterChange("global")}>
                    <span className="mr-2 inline-flex w-3.5 h-3.5 items-center justify-center">
                      {filterKind === "global" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <span className={filterKind === "global" ? "text-primary" : undefined}>
                      全局
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onFilterChange("unknown")}>
                    <span className="mr-2 inline-flex w-3.5 h-3.5 items-center justify-center">
                      {filterKind === "unknown" && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                    <span className={filterKind === "unknown" ? "text-primary" : undefined}>
                      未知
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-lg pb-sm flex-shrink-0">
            <div className="relative">
              <Input
                placeholder="搜索会话..."
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                className="h-8 text-xs pr-7"
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                  onClick={() => onSearchChange("")}
                  aria-label="清空搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {selectionMode && (
            <div className="px-lg pb-sm flex items-center justify-between text-xs text-text-tertiary">
              <button
                className="text-text-secondary hover:text-text-primary"
                onClick={() => {
                  if (isAllSelected) {
                    onClearSelection();
                  } else {
                    onSelectAllKeys(sessions.map((session) => session.key));
                  }
                }}
              >
                {isAllSelected ? "取消全选" : "全选"}
              </button>
              <span>已选 {selectedKeys.length}</span>
            </div>
          )}

          {/* 任务列表内容 - 可收缩 */}
          {isTasksExpanded && (
            <ScrollArea ref={scrollAreaRef} className="flex-1 px-md overflow-y-auto">
              {isLoading ? (
                <div className="space-y-xs pb-lg">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div
                      key={`session-skeleton-${index}`}
                      className="w-full rounded-md px-sm py-sm border border-border-light bg-surface-subtle/60"
                    >
                      <div className="flex items-center gap-sm">
                        <div className="w-5 h-5 rounded bg-background-secondary animate-pulse" />
                        <div className="flex-1 min-w-0">
                          <div className="h-3 w-32 rounded bg-background-secondary animate-pulse" />
                          <div className="mt-1 h-3 w-24 rounded bg-background-secondary animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                // 空状态
                <div className="flex flex-col items-center justify-center py-4xl text-center">
                  <MessageSquare className="w-12 h-12 text-text-tertiary mb-md" />
                  {searchQuery ? (
                    <>
                      <p className="text-sm text-text-secondary mb-xs">没有找到相关会话</p>
                      <p className="text-xs text-text-tertiary">试试清空搜索或换个关键词</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-text-secondary mb-xs">暂无对话</p>
                      <p className="text-xs text-text-tertiary">点击上方按钮</p>
                      <p className="text-xs text-text-tertiary">开始新对话</p>
                    </>
                  )}
                </div>
              ) : (
                // 任务列表 - 不按时间分组
                <div className="space-y-xs pb-lg">
                  {sessions.map((session) => {
                    const isSelected = session.key === currentSessionKey;
                    const title = resolveTitle(session);
                    const unread = unreadMap[session.key] === true;
                    const isChecked = selectedKeys.includes(session.key);

                    return (
                      <button
                        key={session.key}
                        ref={(node) => {
                          sessionRefs.current[session.key] = node;
                        }}
                        onClick={() => {
                          if (selectionMode) {
                            onToggleSelectedKey(session.key);
                          } else {
                            onSelectSession(session.key);
                          }
                        }}
                        className={cn(
                          "w-full text-left rounded-md px-sm py-sm transition-all duration-fast group relative",
                          isSelected ? "bg-primary-light" : "hover:bg-surface-hover",
                        )}
                      >
                        <div className="flex items-center gap-sm">
                          {selectionMode && (
                            <div
                              className={cn(
                                "flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center",
                                isChecked
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleSelectedKey(session.key);
                              }}
                            >
                              {isChecked && <Check className="w-3 h-3" />}
                            </div>
                          )}
                          <div
                            className={cn(
                              "flex-shrink-0 w-5 h-5 flex items-center justify-center",
                              isSelected
                                ? "text-text-primary"
                                : "text-text-tertiary group-hover:text-text-secondary",
                            )}
                          >
                            <MessageSquare className="w-4 h-4" />
                          </div>
                          {/* 标题 - 限制宽度确保省略号生效 */}
                          <div className="flex-1 min-w-0 max-w-[180px]">
                            <div
                              className={cn(
                                "text-xs font-medium truncate",
                                isSelected
                                  ? "text-text-primary"
                                  : "text-text-secondary group-hover:text-text-primary",
                              )}
                            >
                              {title}
                            </div>
                            <div className="text-[11px] text-text-tertiary truncate">
                              {session.lastMessagePreview || resolveUpdatedAt(session)}
                            </div>
                          </div>

                          <div className="flex items-center gap-xs">
                            {unread && <span className="w-2 h-2 rounded-full bg-primary" />}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className={cn(
                                    "flex-shrink-0 w-5 h-5 rounded hover:bg-background-secondary flex items-center justify-center transition-opacity duration-fast",
                                    "opacity-0 group-hover:opacity-100",
                                  )}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5 text-text-tertiary" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewSession(session.key);
                                  }}
                                >
                                  <MessageSquare className="mr-2 h-3.5 w-3.5" />
                                  详情
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRenameSession(session.key);
                                  }}
                                >
                                  <FiEdit3 className="mr-2 h-3.5 w-3.5" />
                                  重命名
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-error focus:text-error"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteSession(session.key);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}

          {selectionMode && selectedKeys.length > 0 && (
            <div className="px-lg py-sm border-t border-border-light flex items-center gap-sm">
              <button
                className="w-full text-xs px-sm py-xs rounded-md bg-error/10 hover:bg-error/20 transition-colors text-error"
                onClick={onBatchDelete}
              >
                批量删除
              </button>
            </div>
          )}
        </div>

        {/* 底部功能区 */}
        <div className="p-md flex-shrink-0 border-t border-border-light">
          <div className="flex items-center gap-sm">
            {/* 设置 - 仅图标（左侧） */}
            <button
              onClick={() => openSettings()}
              className="flex-shrink-0 w-6 h-6 rounded hover:bg-background-secondary transition-colors flex items-center justify-center"
              title="设置"
            >
              <Settings className="w-3.5 h-3.5 text-text-tertiary" />
            </button>

            {/* 占位符 - 撑开空间 */}
            <div className="flex-1" />

            {/* 关于企业运营助手 - 图标+文字（最右侧） */}
            <button
              className="flex-shrink-0 flex items-center gap-xs px-sm py-xs hover:bg-background-secondary transition-colors rounded-md"
              onClick={() => setAboutOpen(true)}
            >
              <Info className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
              <span className="text-xs text-text-tertiary whitespace-nowrap">关于企业运营助手</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
