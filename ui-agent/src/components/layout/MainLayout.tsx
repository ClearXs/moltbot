"use client";

import { ReactNode, useState } from "react";
import type { GatewaySessionRow } from "@/types/clawdbot";
import Sidebar from "../sidebar/Sidebar";
import { ToastStack } from "../ui/toast-stack";
import { TopBar } from "./TopBar";

interface MainLayoutProps {
  children: ReactNode;
  userName?: string;
  sessions?: GatewaySessionRow[];
  unreadMap?: Record<string, boolean>;
  currentSessionKey?: string | null;
  isLoading?: boolean;
  conversationTitle?: string;
  onSelectSession?: (key: string) => void;
  onNewSession?: () => void;
  onRenameSession?: (key: string) => void;
  onDeleteSession?: (key: string) => void;
  onViewSession?: (key: string) => void;
  searchQuery?: string;
  filterKind?: "all" | "direct" | "group" | "global" | "unknown";
  onSearchChange?: (value: string) => void;
  onFilterChange?: (value: MainLayoutProps["filterKind"]) => void;
  unreadOnly?: boolean;
  onUnreadToggle?: (value: boolean) => void;
  sortMode?: "recent" | "name";
  onSortChange?: (value: MainLayoutProps["sortMode"]) => void;
  selectionMode?: boolean;
  selectedKeys?: string[];
  onToggleSelectionMode?: () => void;
  onToggleSelectedKey?: (key: string) => void;
  onSelectAllKeys?: (keys: string[]) => void;
  onClearSelection?: () => void;
  onBatchDelete?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  onRename?: () => void;
  showTopBar?: boolean;
  onOpenKnowledge?: () => void;
  activeMainView?: "chat" | "knowledge";
}

const MainLayout = ({
  children,
  userName = "用户",
  sessions = [],
  unreadMap = {},
  currentSessionKey = null,
  isLoading = false,
  conversationTitle,
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
  onShare = () => {},
  onExport = () => {},
  onDelete = () => {},
  onRename = () => {},
  showTopBar = true,
  onOpenKnowledge = () => {},
  activeMainView = "chat",
}: MainLayoutProps) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <ToastStack />
      {/* Sidebar with integrated branding */}
      <Sidebar
        sessions={sessions}
        unreadMap={unreadMap}
        currentSessionKey={currentSessionKey}
        isLoading={isLoading}
        onSelectSession={onSelectSession}
        onNewSession={onNewSession}
        onRenameSession={onRenameSession}
        onDeleteSession={onDeleteSession}
        onViewSession={onViewSession}
        searchQuery={searchQuery}
        filterKind={filterKind}
        onSearchChange={onSearchChange}
        onFilterChange={onFilterChange}
        unreadOnly={unreadOnly}
        onUnreadToggle={onUnreadToggle}
        sortMode={sortMode}
        onSortChange={onSortChange}
        selectionMode={selectionMode}
        selectedKeys={selectedKeys}
        onToggleSelectionMode={onToggleSelectionMode}
        onToggleSelectedKey={onToggleSelectedKey}
        onSelectAllKeys={onSelectAllKeys}
        onClearSelection={onClearSelection}
        onBatchDelete={onBatchDelete}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onOpenKnowledge={onOpenKnowledge}
        activeMainView={activeMainView}
      />

      {/* Main content - full height */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background-tertiary">
        {/* TopBar - context aware */}
        {showTopBar && (
          <TopBar
            mode={currentSessionKey ? "chat" : "welcome"}
            conversationTitle={conversationTitle}
            userName={userName}
            onShare={onShare}
            onExport={onExport}
            onDelete={onDelete}
            onRename={onRename}
          />
        )}

        {/* Content area */}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
