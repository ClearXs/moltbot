"use client";

import { useRef, useEffect } from "react";
import { FileItemProps } from "@/components/files/FileList";
import { useStreamingReplay } from "@/contexts/StreamingReplayContext";
import { AgentMessage, AgentMessageProps } from "../agent/AgentMessage";
import { MessageBubble } from "./MessageBubble";

export interface Message {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  timestamp: Date;
  usage?: {
    input?: number;
    output?: number;
    total?: number;
  };
  toolCalls?: Array<{
    id?: string;
    name?: string;
    arguments?: unknown;
    status?: "running" | "done";
    durationMs?: number;
  }>;
  toolResults?: Array<{
    toolCallId?: string;
    toolName?: string;
    content?: string;
    isError?: boolean;
    durationMs?: number;
  }>;
  status?: "sending" | "failed";
  retryPayload?: {
    message: string;
    attachments?: File[];
  };
  agentData?: AgentMessageProps;
  files?: FileItemProps[];
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  emptyState?: {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  loadMore?: {
    label?: string;
    onLoadMore: () => void;
    isLoading?: boolean;
    hasMore: boolean;
  };
  onRetryMessage?: (message: Message) => void;
  onEditMessage?: (message: Message) => void;
  onCopyMessage?: (message: Message) => void;
  onDeleteMessage?: (message: Message) => void;
  highlightMessageId?: string | null;
}

export function MessageList({
  messages,
  isLoading = false,
  emptyState,
  loadMore,
  onRetryMessage,
  onEditMessage,
  onCopyMessage,
  onDeleteMessage,
  highlightMessageId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const { shouldShowMessage } = useStreamingReplay();

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!highlightMessageId) return;
    const node = messageRefs.current[highlightMessageId];
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightMessageId]);

  return (
    <div className="flex-1 overflow-y-auto px-md md:px-xl lg:px-2xl py-lg flex flex-col items-center">
      <div className="w-full md:max-w-[800px] lg:max-w-[1000px]">
        {loadMore?.hasMore && (
          <div className="flex justify-center py-md">
            <button
              type="button"
              onClick={loadMore.onLoadMore}
              disabled={loadMore.isLoading}
              className="rounded-md border border-border-light px-md py-xs text-xs text-text-primary hover:bg-background-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadMore.isLoading ? "加载中..." : (loadMore.label ?? "加载更多")}
            </button>
          </div>
        )}
        {messages.length === 0 && !isLoading && emptyState && (
          <div className="flex flex-col items-center justify-center gap-sm py-2xl text-center text-text-tertiary">
            <div className="text-sm text-text-secondary">{emptyState.title}</div>
            {emptyState.description && <div className="text-xs">{emptyState.description}</div>}
            {emptyState.actionLabel && emptyState.onAction && (
              <button
                type="button"
                onClick={emptyState.onAction}
                className="mt-sm rounded-md border border-border-light px-md py-xs text-xs text-text-primary hover:bg-background-secondary"
              >
                {emptyState.actionLabel}
              </button>
            )}
          </div>
        )}
        {/* 消息列表 - 重放时过滤未到达的消息 */}
        {messages.map((message, index) => {
          // 检查消息是否应该显示
          if (!shouldShowMessage(index)) {
            return null;
          }

          if (message.role === "agent" && message.agentData) {
            return <AgentMessage key={message.id} {...message.agentData} messageIndex={index} />;
          }

          return (
            <div
              key={message.id}
              ref={(node) => {
                messageRefs.current[message.id] = node;
              }}
            >
              <MessageBubble
                role={message.role as "user" | "assistant"}
                content={message.content}
                timestamp={message.timestamp}
                files={message.files}
                usage={message.usage}
                toolCalls={message.toolCalls}
                toolResults={message.toolResults}
                status={message.status}
                isHighlighted={message.id === highlightMessageId}
                onRetry={onRetryMessage ? () => onRetryMessage(message) : undefined}
                onEditRetry={onEditMessage ? () => onEditMessage(message) : undefined}
                onCopyRetry={onCopyMessage ? () => onCopyMessage(message) : undefined}
                onDelete={onDeleteMessage ? () => onDeleteMessage(message) : undefined}
                messageIndex={index}
              />
            </div>
          );
        })}

        {/* 加载指示器 */}
        {isLoading && (
          <div className="flex items-center gap-sm text-text-tertiary mb-lg">
            <div className="w-8 h-8 rounded-full bg-background-secondary flex items-center justify-center">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            </div>
            <span className="text-sm">Agent正在思考...</span>
          </div>
        )}

        {/* 自动滚动锚点 */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
