"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComputerPanelWrapper } from "@/components/agent/ComputerPanelWrapper";
import { EnhancedChatInput } from "@/components/chat/EnhancedChatInput";
import { MessageList, Message } from "@/components/chat/MessageList";
import { FileItemProps } from "@/components/files/FileList";
import { KnowledgeBasePage } from "@/components/knowledge/KnowledgeBasePage";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { WelcomePage } from "@/components/welcome/WelcomePage";
import { StreamingReplayProvider, useStreamingReplay } from "@/contexts/StreamingReplayContext";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useToastStore } from "@/stores/toastStore";

// 内部组件，使用StreamingReplayContext
function HomeContent() {
  const {
    activeSessionKey,
    fetchSessions,
    selectSession,
    createSession,
    renameSession,
    deleteSession,
    getSessionByKey,
    getUnreadMap,
    isLoading: isSessionsLoading,
    searchQuery,
    filterKind,
    setSearchQuery,
    setFilterKind,
    unreadOnly,
    setUnreadOnly,
    sortMode,
    setSortMode,
    getFilteredSessions,
    selectionMode,
    selectedKeys,
    toggleSelectionMode,
    toggleSelectedKey,
    selectAllKeys,
    clearSelection,
  } = useSessionStore();
  const { status, wsClient } = useConnectionStore();
  const { addToast } = useToastStore();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [activeMainView, setActiveMainView] = useState<"chat" | "knowledge">("chat");
  const { isStreaming, startStreaming, stopStreaming } = useStreamingReplay();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [detailSessionKey, setDetailSessionKey] = useState<string | null>(null);
  const [historyLoadingKey, setHistoryLoadingKey] = useState<string | null>(null);
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>({});
  const [historyLimits, setHistoryLimits] = useState<Record<string, number>>({});
  const historyDefaultLimit = 200;
  const historyMaxLimit = 1000;
  const [toolEventsByRun, setToolEventsByRun] = useState<
    Record<
      string,
      {
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
      }
    >
  >({});
  const [toolStartTimes, setToolStartTimes] = useState<Record<string, number>>({});
  const usageAppliedByRunKeyRef = useRef<Record<string, boolean>>({});
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftAttachments, setDraftAttachments] = useState<File[]>([]);
  const [highlightDraft, setHighlightDraft] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Dialog states
  type DialogType = "rename" | "delete" | "batchDelete" | null;
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [dialogSessionKey, setDialogSessionKey] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");

  // 动态消息状态管理 - 支持多轮对话
  const [conversationMessages, setConversationMessages] = useState<Record<string, Message[]>>({});

  useEffect(() => {
    if (status === "connected") {
      void fetchSessions();
    }
  }, [status, fetchSessions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSessions();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery, fetchSessions]);

  useEffect(() => {
    void fetchSessions();
  }, [filterKind, fetchSessions]);

  useEffect(() => {
    if (activeSessionKey) {
      setCurrentConversationId(activeSessionKey);
    }
  }, [activeSessionKey]);

  useEffect(() => {
    setDraftMessage("");
    setDraftAttachments([]);
  }, [currentConversationId]);

  const extractMessageText = useCallback((content: unknown): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (part && typeof part === "object" && "text" in part) {
            const value = (part as { text?: string }).text;
            return typeof value === "string" ? value : "";
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }, []);

  const normalizeUsage = useCallback((usage: unknown) => {
    if (!usage || typeof usage !== "object") return undefined;
    const record = usage as Record<string, unknown>;
    const resolveNumber = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value) ? value : undefined;
    const input =
      resolveNumber(record.input) ??
      resolveNumber(record.inputTokens) ??
      resolveNumber(record.prompt_tokens) ??
      resolveNumber(record.promptTokens);
    const output =
      resolveNumber(record.output) ??
      resolveNumber(record.outputTokens) ??
      resolveNumber(record.completion_tokens) ??
      resolveNumber(record.completionTokens);
    const total =
      resolveNumber(record.total) ??
      resolveNumber(record.totalTokens) ??
      resolveNumber(record.total_tokens);
    if (input == null && output == null && total == null) return undefined;
    return { input, output, total };
  }, []);

  const mergeUsage = useCallback(
    (base: Message["usage"] | undefined, next: Message["usage"] | undefined, runKey: string) => {
      if (!next) return base;
      if (usageAppliedByRunKeyRef.current[runKey]) {
        return base;
      }
      usageAppliedByRunKeyRef.current[runKey] = true;
      if (!base) return next;
      return {
        input: (base.input ?? 0) + (next.input ?? 0),
        output: (base.output ?? 0) + (next.output ?? 0),
        total: (base.total ?? 0) + (next.total ?? 0),
      };
    },
    [],
  );

  const resolveGroupKey = useCallback((sessionKey: string, runId: string, turnId?: string) => {
    const groupId = typeof turnId === "string" && turnId.trim() ? turnId : runId;
    return `${sessionKey}:${groupId}`;
  }, []);

  const mergeToolCalls = useCallback(
    (
      existing:
        | Array<{
            id?: string;
            name?: string;
            arguments?: unknown;
            status?: "running" | "done";
            durationMs?: number;
          }>
        | undefined,
      incoming:
        | Array<{
            id?: string;
            name?: string;
            arguments?: unknown;
            status?: "running" | "done";
            durationMs?: number;
          }>
        | undefined,
    ) => {
      const next = new Map<
        string,
        {
          id?: string;
          name?: string;
          arguments?: unknown;
          status?: "running" | "done";
          durationMs?: number;
        }
      >();
      const push = (item: { id?: string; name?: string; arguments?: unknown }) => {
        const key = item.id ?? item.name ?? `call-${next.size}`;
        const previous = next.get(key);
        next.set(key, { ...previous, ...item });
      };
      existing?.forEach(push);
      incoming?.forEach(push);
      return Array.from(next.values());
    },
    [],
  );

  const mergeToolResults = useCallback(
    (
      existing:
        | Array<{
            toolCallId?: string;
            toolName?: string;
            content?: string;
            isError?: boolean;
            durationMs?: number;
          }>
        | undefined,
      incoming:
        | Array<{
            toolCallId?: string;
            toolName?: string;
            content?: string;
            isError?: boolean;
            durationMs?: number;
          }>
        | undefined,
    ) => {
      const next = new Map<
        string,
        {
          toolCallId?: string;
          toolName?: string;
          content?: string;
          isError?: boolean;
          durationMs?: number;
        }
      >();
      const push = (item: {
        toolCallId?: string;
        toolName?: string;
        content?: string;
        isError?: boolean;
        durationMs?: number;
      }) => {
        const key = item.toolCallId ?? item.toolName ?? `result-${next.size}`;
        const previous = next.get(key);
        next.set(key, { ...previous, ...item });
      };
      existing?.forEach(push);
      incoming?.forEach(push);
      return Array.from(next.values());
    },
    [],
  );

  const formatToolResult = useCallback((result: unknown, meta?: string) => {
    let base = "";
    if (typeof result === "string") {
      base = result;
    } else if (result != null) {
      try {
        base = JSON.stringify(result, null, 2);
      } catch {
        base = String(result);
      }
    }
    if (meta && base) return `${meta}\n${base}`;
    return meta ?? base;
  }, []);

  const normalizeHistoryMessages = useCallback(
    (messages: unknown[]): Message[] => {
      const normalized: Message[] = [];
      messages.forEach((item, index) => {
        const raw = item as {
          role?: string;
          content?: unknown;
          createdAt?: number | string;
          timestamp?: number;
          toolCallId?: string;
          toolName?: string;
          isError?: boolean;
          usage?: unknown;
        };
        const role = raw?.role;
        if (role === "toolResult") {
          const last = normalized[normalized.length - 1];
          if (last && last.role === "assistant") {
            const toolResult = {
              toolCallId: raw.toolCallId,
              toolName: raw.toolName,
              isError: raw.isError,
              content: extractMessageText(raw.content ?? ""),
            };
            last.toolResults = [...(last.toolResults ?? []), toolResult];
          }
          return;
        }

        const mappedRole =
          role === "user" || role === "assistant" || role === "system" ? role : "assistant";
        const text = extractMessageText(raw?.content ?? item);
        const createdAt = raw?.createdAt ?? raw?.timestamp;
        const timestamp =
          typeof createdAt === "number"
            ? new Date(createdAt)
            : typeof createdAt === "string"
              ? new Date(createdAt)
              : new Date();

        const toolCalls: Array<{ id?: string; name?: string; arguments?: unknown }> = [];
        if (Array.isArray(raw?.content)) {
          raw.content.forEach((part) => {
            if (!part || typeof part !== "object") return;
            const entry = part as {
              type?: string;
              id?: string;
              name?: string;
              arguments?: unknown;
            };
            if (
              entry.type === "toolCall" ||
              entry.type === "toolUse" ||
              entry.type === "functionCall"
            ) {
              toolCalls.push({
                id: entry.id,
                name: entry.name,
                arguments: entry.arguments,
              });
            }
          });
        }

        normalized.push({
          id: `history-${index}-${timestamp.getTime()}`,
          role: mappedRole === "system" ? "assistant" : mappedRole,
          content: text || (toolCalls.length > 0 ? "[工具调用]" : "[无文本内容]"),
          timestamp,
          usage: normalizeUsage(raw?.usage),
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });
      });
      return normalized;
    },
    [extractMessageText, normalizeUsage],
  );

  const fetchHistory = useCallback(
    async (sessionKey: string, force = false, limitOverride?: number) => {
      if (!wsClient) return;
      if (!force && conversationMessages[sessionKey]) return;
      const limit =
        typeof limitOverride === "number"
          ? limitOverride
          : (historyLimits[sessionKey] ?? historyDefaultLimit);
      setHistoryLoadingKey(sessionKey);
      try {
        const result = await wsClient.sendRequest<{ messages?: unknown[] }>("chat.history", {
          sessionKey,
          limit,
        });
        const history = normalizeHistoryMessages(result?.messages ?? []);
        setConversationMessages((prev) => {
          const existing = prev[sessionKey];
          if (!force && existing && existing.length > 0) {
            return prev;
          }
          return {
            ...prev,
            [sessionKey]: history,
          };
        });
        setHistoryLimits((prev) => ({
          ...prev,
          [sessionKey]: limit,
        }));
        setHistoryErrors((prev) => {
          if (!prev[sessionKey]) return prev;
          const next = { ...prev };
          delete next[sessionKey];
          return next;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "chat.history failed";
        setHistoryErrors((prev) => ({ ...prev, [sessionKey]: message }));
        addToast({
          title: "历史记录加载失败",
          description: message,
          variant: "error",
        });
      } finally {
        setHistoryLoadingKey((current) => (current === sessionKey ? null : current));
      }
    },
    [
      addToast,
      conversationMessages,
      historyLimits,
      historyDefaultLimit,
      normalizeHistoryMessages,
      wsClient,
    ],
  );

  useEffect(() => {
    const sessionKey = activeSessionKey;
    if (!sessionKey) return;
    void fetchHistory(sessionKey);
  }, [activeSessionKey, fetchHistory]);

  useEffect(() => {
    if (!wsClient) return;
    const handleChatEvent = (payload: unknown) => {
      const data = payload as {
        runId?: string;
        turnId?: string;
        sessionKey?: string;
        state?: "delta" | "final" | "error";
        message?: { role?: string; content?: unknown; timestamp?: number };
        errorMessage?: string;
        usage?: unknown;
      };
      const sessionKey = typeof data.sessionKey === "string" ? data.sessionKey : undefined;
      const runId = typeof data.runId === "string" ? data.runId : undefined;
      const turnId = typeof data.turnId === "string" ? data.turnId : undefined;
      if (!sessionKey || !runId) return;
      if (data.message?.role === "user") {
        return;
      }
      const runKey = `${sessionKey}:${runId}`;
      const text = extractMessageText(data.message?.content ?? "");
      const timestampValue = data.message?.timestamp;
      const timestamp = typeof timestampValue === "number" ? new Date(timestampValue) : new Date();
      const groupKey = resolveGroupKey(sessionKey, runId, turnId);
      const messageId = `assistant-${groupKey}`;
      const toolData = toolEventsByRun[groupKey];
      const normalizedUsage = normalizeUsage(data.usage);
      setConversationMessages((prev) => {
        const messages = prev[sessionKey] ? [...prev[sessionKey]!] : [];
        const index = messages.findIndex((msg) => msg.id === messageId);
        if (data.state === "error") {
          const errorText = data.errorMessage?.trim()
            ? `请求失败：${data.errorMessage}`
            : "请求失败，请重试";
          const errorMessage: Message = {
            id: messageId,
            role: "assistant",
            content: errorText,
            timestamp: new Date(),
            toolCalls: toolData?.toolCalls,
            toolResults: toolData?.toolResults,
          };
          if (index >= 0) {
            messages[index] = errorMessage;
          } else {
            messages.push(errorMessage);
          }
          return { ...prev, [sessionKey]: messages };
        }
        if (!text && data.state === "final") {
          if (index >= 0) {
            return { ...prev, [sessionKey]: messages };
          }
          return prev;
        }
        const nextMessage: Message = {
          id: messageId,
          role: "assistant",
          content: text,
          timestamp,
          usage: mergeUsage(
            index >= 0 ? messages[index]?.usage : undefined,
            normalizedUsage,
            runKey,
          ),
          toolCalls: toolData?.toolCalls,
          toolResults: toolData?.toolResults,
        };
        if (index >= 0) {
          messages[index] = {
            ...messages[index],
            ...nextMessage,
            toolCalls: mergeToolCalls(messages[index].toolCalls, nextMessage.toolCalls),
            toolResults: mergeToolResults(messages[index].toolResults, nextMessage.toolResults),
          };
        } else {
          messages.push(nextMessage);
        }
        if (data.state === "final" || data.state === "error") {
          delete usageAppliedByRunKeyRef.current[runKey];
        }
        return { ...prev, [sessionKey]: messages };
      });
    };
    wsClient.addEventListener("chat", handleChatEvent);
    return () => {
      wsClient.removeEventListener("chat", handleChatEvent);
    };
  }, [
    extractMessageText,
    resolveGroupKey,
    mergeUsage,
    mergeToolCalls,
    mergeToolResults,
    normalizeUsage,
    toolEventsByRun,
    wsClient,
  ]);

  useEffect(() => {
    if (!wsClient) return;
    const handleAgentEvent = (payload: unknown) => {
      const data = payload as {
        runId?: string;
        turnId?: string;
        sessionKey?: string;
        stream?: string;
        data?: {
          phase?: string;
          name?: string;
          toolCallId?: string;
          args?: unknown;
          result?: unknown;
          meta?: string;
          isError?: boolean;
        };
      };
      if (data.stream !== "tool") return;
      const sessionKey = typeof data.sessionKey === "string" ? data.sessionKey : undefined;
      const runId = typeof data.runId === "string" ? data.runId : undefined;
      const turnId = typeof data.turnId === "string" ? data.turnId : undefined;
      if (!sessionKey || !runId) return;
      const phase = data.data?.phase;
      const toolCallId =
        typeof data.data?.toolCallId === "string" ? data.data.toolCallId : undefined;
      const toolName = typeof data.data?.name === "string" ? data.data.name : undefined;
      const toolKey = resolveGroupKey(sessionKey, runId, turnId);
      const toolCallKey = toolCallId ? `${toolKey}:${toolCallId}` : undefined;
      const durationMs =
        phase === "result" && toolCallKey && toolStartTimes[toolCallKey] != null
          ? Date.now() - toolStartTimes[toolCallKey]
          : undefined;
      const nextToolCalls =
        phase === "start" || phase === "update"
          ? [
              {
                id: toolCallId,
                name: toolName,
                arguments: data.data?.args,
                status: "running" as const,
              },
            ]
          : undefined;
      const finalToolCall =
        phase === "result"
          ? [
              {
                id: toolCallId,
                name: toolName,
                status: "done" as const,
                durationMs,
              },
            ]
          : undefined;
      const resultContent =
        phase === "result" ? formatToolResult(data.data?.result, data.data?.meta) : undefined;
      const nextToolResults =
        phase === "result"
          ? [
              {
                toolCallId,
                toolName,
                content: resultContent,
                isError: Boolean(data.data?.isError),
                durationMs,
              },
            ]
          : undefined;

      if (nextToolCalls || nextToolResults || finalToolCall) {
        if (phase === "start" && toolCallKey) {
          setToolStartTimes((prev) => ({ ...prev, [toolCallKey]: Date.now() }));
        }
        if (phase === "result" && toolCallKey) {
          setToolStartTimes((prev) => {
            if (!prev[toolCallKey]) return prev;
            const next = { ...prev };
            delete next[toolCallKey];
            return next;
          });
        }
        setToolEventsByRun((prev) => {
          const current = prev[toolKey] ?? {};
          const toolCalls = mergeToolCalls(
            current.toolCalls,
            mergeToolCalls(nextToolCalls, finalToolCall),
          );
          const toolResults = mergeToolResults(current.toolResults, nextToolResults);
          return {
            ...prev,
            [toolKey]: {
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              toolResults: toolResults.length > 0 ? toolResults : undefined,
            },
          };
        });

        setConversationMessages((prev) => {
          const messages = prev[sessionKey] ? [...prev[sessionKey]!] : [];
          const messageId = `assistant-${toolKey}`;
          const index = messages.findIndex((msg) => msg.id === messageId);
          if (index < 0) return prev;
          const existing = messages[index];
          messages[index] = {
            ...existing,
            toolCalls: mergeToolCalls(
              existing.toolCalls,
              mergeToolCalls(nextToolCalls, finalToolCall),
            ),
            toolResults: mergeToolResults(existing.toolResults, nextToolResults),
          };
          return { ...prev, [sessionKey]: messages };
        });
      }
    };
    wsClient.addEventListener("agent", handleAgentEvent);
    return () => {
      wsClient.removeEventListener("agent", handleAgentEvent);
    };
  }, [
    formatToolResult,
    mergeToolCalls,
    mergeToolResults,
    resolveGroupKey,
    toolStartTimes,
    wsClient,
  ]);

  const fileToBase64 = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error("Unexpected file reader result"));
          return;
        }
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const updateMessageById = useCallback(
    (sessionKey: string, messageId: string, updater: (message: Message) => Message) => {
      setConversationMessages((prev) => {
        const messages = prev[sessionKey] ? [...prev[sessionKey]!] : [];
        const index = messages.findIndex((msg) => msg.id === messageId);
        if (index < 0) return prev;
        messages[index] = updater(messages[index]);
        return { ...prev, [sessionKey]: messages };
      });
    },
    [],
  );

  const sendChatPayload = useCallback(
    async (params: { sessionKey: string; message: string; attachments?: File[] }) => {
      const client = useConnectionStore.getState().wsClient;
      if (!client) {
        return { ok: false, error: "尚未连接到网关" };
      }
      const normalizedAttachments =
        params.attachments && params.attachments.length > 0
          ? await Promise.all(
              params.attachments.map(async (file) => ({
                type: file.type.startsWith("image/") ? "image" : "file",
                mimeType: file.type,
                fileName: file.name,
                content: await fileToBase64(file),
              })),
            )
          : undefined;
      const idempotencyKey =
        typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `run-${Date.now()}`;
      try {
        await client.sendRequest("chat.send", {
          sessionKey: params.sessionKey,
          message: params.message,
          idempotencyKey,
          attachments: normalizedAttachments,
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "chat.send failed",
        };
      }
    },
    [fileToBase64],
  );

  const deriveSessionLabel = useCallback((text: string) => {
    const trimmed = text.trim().replace(/\s+/g, " ");
    if (!trimmed) return undefined;
    return trimmed.length > 20 ? `${trimmed.slice(0, 20)}…` : trimmed;
  }, []);

  const currentSession = activeSessionKey ? getSessionByKey(activeSessionKey) : undefined;
  const detailSession = detailSessionKey ? getSessionByKey(detailSessionKey) : undefined;
  const conversationTitle =
    currentSession?.label ||
    currentSession?.derivedTitle ||
    currentSession?.displayName ||
    undefined;

  // 收集当前对话的所有生成文件
  const generatedFiles = useMemo(() => {
    if (!currentConversationId) return [];

    const messages = conversationMessages[currentConversationId] || [];
    const allFiles: FileItemProps[] = [];

    messages.forEach((msg) => {
      if (msg.files && msg.files.length > 0) {
        allFiles.push(...msg.files);
      }
    });

    return allFiles;
  }, [currentConversationId, conversationMessages]);

  const handleNewConversation = async () => {
    if (isStreaming) stopStreaming();
    setActiveMainView("chat");
    setCurrentConversationId(null);
    setDraftMessage("");
    setDraftAttachments([]);
    setHighlightDraft(true);
    window.setTimeout(() => {
      setHighlightDraft(false);
    }, 2000);
    window.setTimeout(() => {
      const input = document.querySelector("textarea");
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        (input as HTMLTextAreaElement).focus();
      }
    }, 0);
  };

  const handleSelectConversation = (id: string) => {
    setActiveMainView("chat");
    setCurrentConversationId(id);
    selectSession(id);
    if (isStreaming) {
      stopStreaming();
    }
  };

  const handleSelectAssistant = (prompt: string) => {
    setActiveMainView("chat");
    console.log("选择示例:", prompt);
    setDraftMessage(prompt);
    setDraftAttachments([]);
    setHighlightDraft(true);
    window.setTimeout(() => {
      setHighlightDraft(false);
    }, 2000);
    window.setTimeout(() => {
      const input = document.querySelector("textarea");
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        (input as HTMLTextAreaElement).focus();
      }
    }, 0);
  };

  const handleSendMessage = async (message: string, attachments?: File[]) => {
    console.log("发送消息:", message);
    console.log("附件:", attachments);

    if (isStreaming) {
      stopStreaming();
    }

    if (!useConnectionStore.getState().wsClient) {
      addToast({
        title: "尚未连接到网关",
        description: "请先完成连接后再发送消息。",
        variant: "error",
      });
      return { ok: false, error: "尚未连接到网关" };
    }
    if (isCreatingSession) {
      return { ok: false, error: "正在创建会话" };
    }

    let sessionKey = currentConversationId;
    if (!sessionKey) {
      setIsCreatingSession(true);
      const label = deriveSessionLabel(message);
      sessionKey = await createSession(label);
      setIsCreatingSession(false);
      if (!sessionKey) {
        addToast({
          title: "新建会话失败",
          description: "请确认网关连接后重试。",
          variant: "error",
        });
        return { ok: false, error: "新建会话失败" };
      }
      setCurrentConversationId(sessionKey);
      setConversationMessages((prev) => ({
        ...prev,
        [sessionKey]: prev[sessionKey] ?? [],
      }));
    }

    // 创建新的用户消息
    const messageId = `msg-${Date.now()}`;
    const newUserMessage: Message = {
      id: messageId,
      role: "user",
      content: message,
      timestamp: new Date(),
      status: "sending",
      retryPayload: { message, attachments },
    };

    // 更新对话消息列表
    setConversationMessages((prev) => ({
      ...prev,
      [sessionKey]: [...(prev[sessionKey] || []), newUserMessage],
    }));

    const result = await sendChatPayload({
      sessionKey,
      message,
      attachments,
    });
    if (result.ok) {
      updateMessageById(sessionKey, messageId, (msg) => ({
        ...msg,
        status: undefined,
        retryPayload: undefined,
      }));
      return { ok: true };
    }
    addToast({
      title: "消息发送失败",
      description: result.error ?? "chat.send failed",
      variant: "error",
    });
    updateMessageById(sessionKey, messageId, (msg) => ({
      ...msg,
      status: "failed",
      retryPayload: msg.retryPayload ?? { message, attachments },
    }));
    return { ok: false, error: result.error ?? "chat.send failed" };
  };

  // 重放按钮点击处理
  const handleReplayClick = () => {
    if (!currentConversationId) {
      return;
    }

    if (isStreaming) {
      stopStreaming();
    } else {
      const messages = conversationMessages[currentConversationId] || [];
      startStreaming(messages);
    }
  };

  // TopBar actions

  const handleShare = () => {
    console.log("分享对话");
    addToast({
      title: "分享功能开发中",
      description: "该功能正在开发中,敬请期待",
    });
  };

  const handleExport = () => {
    console.log("导出对话");
    addToast({
      title: "导出功能开发中",
      description: "该功能正在开发中,敬请期待",
    });
  };

  const handleDelete = () => {
    if (!currentConversationId) return;
    setDialogSessionKey(currentConversationId);
    setActiveDialog("delete");
  };

  const handleRename = () => {
    if (!currentConversationId) return;
    const session = getSessionByKey(currentConversationId);
    setRenameInput(
      session?.label || session?.derivedTitle || session?.displayName || ""
    );
    setDialogSessionKey(currentConversationId);
    setActiveDialog("rename");
  };

  const confirmRename = () => {
    if (!dialogSessionKey || !renameInput.trim()) return;
    void renameSession(dialogSessionKey, renameInput.trim());
    setActiveDialog(null);
    setDialogSessionKey(null);
    setRenameInput("");
  };

  const confirmDelete = () => {
    if (!dialogSessionKey) return;
    void deleteSession(dialogSessionKey);
    if (currentConversationId === dialogSessionKey) {
      setCurrentConversationId(null);
    }
    setActiveDialog(null);
    setDialogSessionKey(null);
  };

  const confirmBatchDelete = () => {
    if (selectedKeys.length === 0) return;
    selectedKeys.forEach((key) => deleteSession(key));
    clearSelection();
    if (selectedKeys.includes(currentConversationId ?? "")) {
      setCurrentConversationId(null);
    }
    setActiveDialog(null);
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setDialogSessionKey(null);
    setRenameInput("");
  };

  const handleViewSession = (key: string) => {
    setDetailSessionKey(key);
  };

  const resolveTokens = (session?: typeof detailSession) => {
    if (!session) return "—";
    if (typeof session.totalTokens === "number") return session.totalTokens;
    const total = (session.inputTokens ?? 0) + (session.outputTokens ?? 0);
    return total > 0 ? total : "—";
  };

  const handleRetryMessage = async (message: Message) => {
    if (!currentConversationId || !message.retryPayload) return;
    updateMessageById(currentConversationId, message.id, (msg) => ({
      ...msg,
      status: "sending",
    }));
    const result = await sendChatPayload({
      sessionKey: currentConversationId,
      message: message.retryPayload.message,
      attachments: message.retryPayload.attachments,
    });
    if (result.ok) {
      updateMessageById(currentConversationId, message.id, (msg) => ({
        ...msg,
        status: undefined,
        retryPayload: undefined,
      }));
      setHighlightMessageId(message.id);
      window.setTimeout(() => {
        setHighlightMessageId((current) => (current === message.id ? null : current));
      }, 2000);
      return;
    }
    addToast({
      title: "消息发送失败",
      description: result.error ?? "chat.send failed",
      variant: "error",
    });
    updateMessageById(currentConversationId, message.id, (msg) => ({
      ...msg,
      status: "failed",
    }));
  };

  const handleEditMessage = (message: Message) => {
    if (!message.retryPayload) return;
    setDraftMessage(message.retryPayload.message);
    setDraftAttachments(message.retryPayload.attachments ?? []);
    setHighlightDraft(true);
    window.setTimeout(() => {
      setHighlightDraft(false);
    }, 2000);
    window.setTimeout(() => {
      const input = document.querySelector("textarea");
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        (input as HTMLTextAreaElement).focus();
      }
    }, 0);
  };

  const handleCopyMessage = (message: Message) => {
    if (!message.retryPayload?.message) return;
    void navigator.clipboard?.writeText(message.retryPayload.message);
    addToast({
      title: "已复制内容",
      description: "可以在输入框中粘贴后快速重发。",
    });
  };

  const handleCopyToDraft = (message: Message) => {
    if (!message.retryPayload?.message) return;
    setDraftMessage(message.retryPayload.message);
    setDraftAttachments(message.retryPayload.attachments ?? []);
    setHighlightDraft(true);
    window.setTimeout(() => {
      setHighlightDraft(false);
    }, 2000);
    window.setTimeout(() => {
      const input = document.querySelector("textarea");
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        (input as HTMLTextAreaElement).focus();
      }
    }, 0);
  };

  const handleDeleteFailedMessage = (message: Message) => {
    if (!currentConversationId) return;
    if (message.status !== "failed") return;
    setConversationMessages((prev) => {
      const messages = prev[currentConversationId] ? [...prev[currentConversationId]!] : [];
      const next = messages.filter((msg) => msg.id !== message.id);
      return { ...prev, [currentConversationId]: next };
    });
  };

  // 获取当前对话的消息
  const currentMessages = currentConversationId
    ? conversationMessages[currentConversationId] || []
    : [];
  const currentHistoryError = currentConversationId
    ? historyErrors[currentConversationId]
    : undefined;
  const currentHistoryLimit = currentConversationId
    ? (historyLimits[currentConversationId] ?? historyDefaultLimit)
    : historyDefaultLimit;
  const canLoadMore =
    !!currentConversationId &&
    currentMessages.length >= currentHistoryLimit &&
    currentHistoryLimit < historyMaxLimit;

  const showWelcomePage =
    !currentConversationId ||
    (currentMessages.length === 0 && historyLoadingKey !== currentConversationId);

  return (
    <>
    <MainLayout
      userName="张三"
      sessions={getFilteredSessions()}
      isLoading={isSessionsLoading}
      unreadMap={getUnreadMap()}
      currentSessionKey={currentConversationId}
      conversationTitle={activeMainView === "knowledge" ? undefined : conversationTitle}
      onSelectSession={handleSelectConversation}
      onNewSession={handleNewConversation}
      onSearchChange={setSearchQuery}
      onFilterChange={(kind) => setFilterKind(kind ?? "all")}
      unreadOnly={unreadOnly}
      onUnreadToggle={setUnreadOnly}
      sortMode={sortMode}
      onSortChange={(mode) => setSortMode(mode ?? "recent")}
      searchQuery={searchQuery}
      filterKind={filterKind}
      selectionMode={selectionMode}
      selectedKeys={selectedKeys}
      onToggleSelectionMode={toggleSelectionMode}
      onToggleSelectedKey={toggleSelectedKey}
      onSelectAllKeys={(keys) => selectAllKeys(keys)}
      onClearSelection={clearSelection}
      onBatchDelete={() => {
        if (selectedKeys.length === 0) return;
        setActiveDialog("batchDelete");
      }}
      onRenameSession={(key) => {
        if (currentConversationId !== key) {
          setCurrentConversationId(key);
        }
        const session = getSessionByKey(key);
        setRenameInput(
          session?.label || session?.derivedTitle || session?.displayName || ""
        );
        setDialogSessionKey(key);
        setActiveDialog("rename");
      }}
      onOpenKnowledge={() => setActiveMainView("knowledge")}
      showTopBar
      activeMainView={activeMainView}
      onDeleteSession={(key) => {
        setDialogSessionKey(key);
        setActiveDialog("delete");
      }}
      onViewSession={handleViewSession}
      onShare={handleShare}
      onExport={handleExport}
      onDelete={handleDelete}
      onRename={handleRename}
    >
      <div className="h-full flex flex-col">
        {/* 主内容区域 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeMainView === "knowledge" ? (
            <div className="flex-1 overflow-hidden bg-background-tertiary">
              <KnowledgeBasePage />
            </div>
          ) : !showWelcomePage ? (
            // 对话内容区域
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* 消息列表 */}
                <MessageList
                  messages={currentMessages}
                  isLoading={historyLoadingKey === currentConversationId}
                  emptyState={{
                    title: currentHistoryError ? "历史记录加载失败" : "暂无消息",
                    description: currentHistoryError
                      ? "请检查网关连接后重试"
                      : "发送第一条消息开始对话",
                    actionLabel: currentHistoryError ? "重试" : undefined,
                    onAction:
                      currentHistoryError && currentConversationId
                        ? () => {
                            void fetchHistory(currentConversationId, true);
                          }
                        : undefined,
                  }}
                  loadMore={{
                    hasMore: canLoadMore,
                    isLoading: historyLoadingKey === currentConversationId,
                    onLoadMore: () => {
                      if (!currentConversationId) return;
                      const nextLimit = Math.min(
                        historyMaxLimit,
                        currentHistoryLimit + historyDefaultLimit,
                      );
                      void fetchHistory(currentConversationId, true, nextLimit);
                    },
                  }}
                  onRetryMessage={handleRetryMessage}
                  onEditMessage={handleEditMessage}
                  onCopyMessage={handleCopyToDraft}
                  onDeleteMessage={handleDeleteFailedMessage}
                  highlightMessageId={highlightMessageId}
                />

                {/* 输入框 - 底部 */}
                <div className="flex-shrink-0">
                  {/* 触发按钮横条 - 在有文件时显示 */}
                  <ComputerPanelWrapper
                    files={generatedFiles}
                    isOpen={workspaceOpen}
                    onToggle={() => setWorkspaceOpen((prev) => !prev)}
                    compact={true}
                  />

                  <EnhancedChatInput
                    onSend={handleSendMessage}
                    placeholder="输入消息... (支持 @ 提及和 / 命令)"
                    compact={true}
                    draftValue={draftMessage}
                    onDraftChange={setDraftMessage}
                    draftAttachments={draftAttachments}
                    onDraftAttachmentsChange={setDraftAttachments}
                    highlight={highlightDraft}
                    onWorkspaceClick={() => setWorkspaceOpen((prev) => !prev)}
                    hasGeneratedFiles={generatedFiles.length > 0}
                    workspaceOpen={workspaceOpen}
                  />
                </div>
              </div>
            </div>
          ) : (
            // 欢迎页面 - 垂直居中包含输入框
            <div className="flex-1 flex flex-col items-center justify-center px-2xl">
              <div className="w-full max-w-[900px]">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-text-primary mb-md">企业运营助手</h1>
                  <p className="text-sm text-text-tertiary mb-2xl">
                    选择一个模板快速开始，或直接输入您的需求
                  </p>
                </div>
                {/* 输入框 - 居中显示 */}
                <div className="mt-3xl">
                  {/* 触发按钮横条 - 在有文件时显示 */}
                  <ComputerPanelWrapper
                    files={generatedFiles}
                    isOpen={workspaceOpen}
                    onToggle={() => setWorkspaceOpen((prev) => !prev)}
                    compact={false}
                  />

                  <EnhancedChatInput
                    onSend={handleSendMessage}
                    placeholder="输入您的需求..."
                    compact={false}
                    draftValue={draftMessage}
                    onDraftChange={setDraftMessage}
                    draftAttachments={draftAttachments}
                    onDraftAttachmentsChange={setDraftAttachments}
                    highlight={highlightDraft}
                    onWorkspaceClick={() => setWorkspaceOpen((prev) => !prev)}
                    hasGeneratedFiles={generatedFiles.length > 0}
                    workspaceOpen={workspaceOpen}
                  />
                </div>
                <div className="mt-2xl">
                  <WelcomePage
                    onSelectPrompt={handleSelectAssistant}
                    compact={true}
                    variant="cards"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* 会话详情对话框 */}
      <Dialog open={Boolean(detailSessionKey)} onOpenChange={() => setDetailSessionKey(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">会话详情</DialogTitle>
          </DialogHeader>
          {detailSession ? (
            <div className="space-y-sm text-sm text-text-secondary">
              <div className="flex items-center justify-between">
                <span>标题</span>
                <span className="text-text-primary">
                  {detailSession.label ||
                    detailSession.derivedTitle ||
                    detailSession.displayName ||
                    "未命名"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Session Key</span>
                <span className="text-text-primary truncate max-w-[200px]">
                  {detailSession.key}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>最近活动</span>
                <span className="text-text-primary">
                  {detailSession.updatedAt
                    ? new Date(detailSession.updatedAt).toLocaleString("zh-CN", {
                        hour12: false,
                      })
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Token 使用量</span>
                <span className="text-text-primary">{resolveTokens(detailSession)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Channel</span>
                <span className="text-text-primary">{detailSession.channel || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Model</span>
                <span className="text-text-primary">
                  {detailSession.model || detailSession.modelProvider || "—"}
                </span>
              </div>
              {detailSession.lastMessagePreview && (
                <div className="rounded-md border border-border-light bg-background-secondary p-2 text-xs">
                  {detailSession.lastMessagePreview}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-text-tertiary">未找到会话数据。</div>
          )}
          <DialogFooter className="gap-sm">
            {detailSession && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(detailSession.key);
                }}
              >
                复制 Session Key
              </Button>
            )}
            <Button size="sm" onClick={() => setDetailSessionKey(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名对话框 */}
      <Dialog open={activeDialog === "rename"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>重命名对话</DialogTitle>
            <DialogDescription>请输入新的对话标题</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="输入新的对话标题"
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameInput.trim()) {
                  confirmRename();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button onClick={confirmRename} disabled={!renameInput.trim()}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={activeDialog === "delete"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除对话</DialogTitle>
            <DialogDescription>确定要删除此对话吗?删除后将无法恢复。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量删除确认对话框 */}
      <Dialog open={activeDialog === "batchDelete"} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量删除</DialogTitle>
            <DialogDescription>
              确定要删除 {selectedKeys.length} 个会话吗?删除后将无法恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmBatchDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>

    {/* 全局设置对话框 */}
    <SettingsDialog />
    </>
  );
}

// 主组件，包裹StreamingReplayProvider
export default function Home() {
  return (
    <StreamingReplayProvider>
      <HomeContent />
    </StreamingReplayProvider>
  );
}
