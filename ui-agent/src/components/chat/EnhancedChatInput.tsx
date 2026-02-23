"use client";

import {
  Send,
  Paperclip,
  Image as ImageIcon,
  Mic,
  AtSign,
  Sparkles,
  Plug,
  Loader2,
  Check,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConnectionStore } from "@/stores/connectionStore";
import { useSettingsStore } from "@/stores/settingsStore";

interface EnhancedChatInputProps {
  onSend: (message: string, attachments?: File[]) => Promise<{ ok: boolean; error?: string }>;
  draftValue?: string;
  onDraftChange?: (value: string) => void;
  draftAttachments?: File[];
  onDraftAttachmentsChange?: (files: File[]) => void;
  highlight?: boolean;
  disabled?: boolean;
  placeholder?: string;
  compact?: boolean; // 是否紧凑模式(对话页面)
  onWorkspaceClick?: () => void; // 点击查看工作区(已废弃,由外部横条控制)
  hasGeneratedFiles?: boolean; // 是否有生成的文件(已废弃)
  workspaceOpen?: boolean; // 工作区是否打开(已废弃)
  connectors?: Array<{
    id: string;
    name: string;
    status?: "connected" | "disconnected" | "error" | "draft";
  }>;
  activeConnectorIds?: string[];
  onToggleConnector?: (id: string, enabled: boolean) => void;
}

interface SkillStatusEntry {
  skillKey: string;
  name: string;
  description: string;
  disabled: boolean;
  eligible: boolean;
}

interface SkillStatusReport {
  skills: SkillStatusEntry[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function EnhancedChatInput({
  onSend,
  draftValue,
  onDraftChange,
  draftAttachments,
  onDraftAttachmentsChange,
  highlight = false,
  disabled = false,
  placeholder = "输入消息...",
  compact = false,
  onWorkspaceClick,
  hasGeneratedFiles = false,
  workspaceOpen = false,
  connectors = [],
  activeConnectorIds = [],
  onToggleConnector,
}: EnhancedChatInputProps) {
  const wsClient = useConnectionStore((s) => s.wsClient);
  const openSettings = useSettingsStore((s) => s.openSettings);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillStatusEntry[]>([]);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [skillsQuery, setSkillsQuery] = useState("");
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputValue = draftValue ?? input;
  const attachmentValue = draftAttachments ?? attachments;
  const skillKeySet = useMemo(() => new Set(skills.map((skill) => skill.skillKey)), [skills]);
  const connectedConnectors = useMemo(
    () => connectors.filter((connector) => connector.status === "connected"),
    [connectors],
  );

  const selectedSkillKeys = useMemo(() => {
    const tokens = inputValue.match(/\/[A-Za-z0-9._-]+/g) ?? [];
    const keys = tokens
      .map((token) => token.slice(1))
      .filter(
        (skillKey, index, list) => list.indexOf(skillKey) === index && skillKeySet.has(skillKey),
      );
    return keys;
  }, [inputValue, skillKeySet]);

  const filteredSkills = useMemo(() => {
    const query = skillsQuery.trim().toLowerCase();
    const matched = !query
      ? skills
      : skills.filter((skill) => {
          return (
            skill.name.toLowerCase().includes(query) ||
            skill.skillKey.toLowerCase().includes(query) ||
            (skill.description ?? "").toLowerCase().includes(query)
          );
        });
    return [...matched].sort((a, b) => {
      const aAvailable = !a.disabled && a.eligible;
      const bAvailable = !b.disabled && b.eligible;
      if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
      return a.name.localeCompare(b.name, "zh-CN") || a.skillKey.localeCompare(b.skillKey, "zh-CN");
    });
  }, [skills, skillsQuery]);

  const updateInputValue = (nextValue: string) => {
    if (onDraftChange) {
      onDraftChange(nextValue);
    } else {
      setInput(nextValue);
    }
  };

  const loadSkills = useCallback(async () => {
    if (!wsClient || isSkillsLoading) return;
    setIsSkillsLoading(true);
    setSkillsError(null);
    try {
      const result = await wsClient.sendRequest<SkillStatusReport>("skills.status", {});
      const allSkills = result.skills.sort((a, b) => a.name.localeCompare(b.name, "zh-CN")) ?? [];
      setSkills(allSkills);
    } catch (error) {
      setSkills([]);
      setSkillsError(error instanceof Error ? error.message : "无法获取技能列表");
    } finally {
      setIsSkillsLoading(false);
    }
  }, [isSkillsLoading, wsClient]);

  const handleSkillsOpenChange = (open: boolean) => {
    setSkillsOpen(open);
    if (open && (skills.length === 0 || skillsError)) {
      void loadSkills();
    }
    if (!open) {
      setSkillsQuery("");
    }
  };

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateInputValue(e.target.value);
    if (sendError) setSendError(null);
    adjustTextareaHeight();
  };

  const handleInsertSkill = (skillKey: string) => {
    const token = `/${skillKey}`;
    const exists = selectedSkillKeys.includes(skillKey);
    if (exists) {
      const pattern = new RegExp(`(^|\\s)${escapeRegExp(token)}(?=\\s|$)`, "g");
      const next = inputValue.replace(pattern, " ").replace(/\s+/g, " ").trimStart();
      updateInputValue(next);
      return;
    }
    const next = inputValue.trim() ? `${token} ${inputValue}` : `${token} `;
    updateInputValue(next);
  };

  const handleInsertMentionOrCommand = (token: "@ " | "/ ") => {
    if (inputValue.includes(token.trim())) {
      return;
    }
    updateInputValue(inputValue.trim() ? `${inputValue} ${token}` : token);
    textareaRef.current?.focus();
  };

  // 废弃参数保留为兼容字段,避免未来接入断裂
  void onWorkspaceClick;
  void hasGeneratedFiles;
  void workspaceOpen;

  // 处理发送
  const handleSend = async () => {
    if (!inputValue.trim() && attachmentValue.length === 0) return;
    if (disabled || isSending) return;

    setIsSending(true);
    const result = await onSend(
      inputValue,
      attachmentValue.length > 0 ? attachmentValue : undefined,
    );
    setIsSending(false);
    if (result.ok) {
      if (onDraftChange) {
        onDraftChange("");
      } else {
        setInput("");
      }
      if (onDraftAttachmentsChange) {
        onDraftAttachmentsChange([]);
      } else {
        setAttachments([]);
      }
      setSendError(null);

      // 重置文本框高度
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } else {
      setSendError(result.error ?? "发送失败，请重试");
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      return file.size <= maxSize;
    });

    if (validFiles.length < files.length) {
      alert("部分文件超过10MB限制,已自动过滤");
    }

    if (onDraftAttachmentsChange) {
      onDraftAttachmentsChange([...(draftAttachments ?? attachments), ...validFiles]);
    } else {
      setAttachments((prev) => [...prev, ...validFiles]);
    }
    if (e.target) e.target.value = "";
  };

  // 移除附件
  const removeAttachment = (index: number) => {
    if (onDraftAttachmentsChange) {
      onDraftAttachmentsChange((draftAttachments ?? attachments).filter((_, i) => i !== index));
    } else {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <div>
      {/* 附件预览 */}
      {attachmentValue.length > 0 && (
        <div className="px-2xl pt-md pb-sm flex flex-wrap gap-xs">
          {attachmentValue.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-xs px-sm py-xs bg-background-secondary rounded text-xs text-text-secondary"
            >
              <Paperclip className="w-3 h-3" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="text-text-tertiary hover:text-error"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {sendError && (
        <div className="px-2xl pb-sm">
          <div className="flex items-center justify-between gap-sm rounded-md border border-error/40 bg-error/10 px-md py-sm text-xs text-error">
            <span>{sendError}</span>
            <button
              type="button"
              onClick={handleSend}
              className="rounded border border-error/40 px-sm py-xs text-error hover:bg-error/10"
            >
              重试发送
            </button>
          </div>
        </div>
      )}

      {/* 输入区域 - Manus风格 */}
      <div className={compact ? "py-md flex flex-col items-center" : "flex flex-col items-center"}>
        <div className="w-full md:max-w-[800px] lg:max-w-[1000px] px-md md:px-xl lg:px-2xl">
          <div
            className={`flex flex-col gap-sm border border-border transition-shadow ${
              compact
                ? "bg-background-secondary rounded-xl px-md py-md"
                : "bg-background-secondary rounded-2xl px-lg py-lg shadow-sm"
            } ${highlight ? "ring-2 ring-primary/40 shadow-[0_0_0_6px_rgba(99,102,241,0.15)] animate-attention" : ""}`}
          >
            {/* 文本输入框 */}
            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={placeholder}
                rows={2}
                className={`w-full resize-none border-none outline-none bg-transparent ${compact ? "text-sm" : "text-base"} text-text-primary placeholder:text-text-tertiary disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{ maxHeight: "200px", minHeight: "72px" }}
              />
            </div>

            {/* 工具按钮 - 底部对齐 */}
            <div className="flex items-center justify-between gap-sm pb-xs">
              <div className="flex items-center gap-xs">
                <Popover open={skillsOpen} onOpenChange={handleSkillsOpenChange}>
                  <PopoverTrigger asChild>
                    <button
                      disabled={disabled}
                      className="relative p-sm rounded-lg hover:bg-background text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="选择 Skills"
                    >
                      <Sparkles className="w-5 h-5" />
                      {selectedSkillKeys.length > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[11px] leading-[18px] text-center">
                          {selectedSkillKeys.length}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    className="w-[340px] p-2 rounded-xl border-border-light bg-surface shadow-xl"
                  >
                    <div className="px-2 py-1.5">
                      <Input
                        value={skillsQuery}
                        onChange={(e) => setSkillsQuery(e.target.value)}
                        placeholder="筛选技能..."
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="max-h-64 overflow-auto space-y-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                      {isSkillsLoading ? (
                        <div className="flex items-center gap-2 px-2 py-2 text-xs text-text-tertiary">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          加载技能中...
                        </div>
                      ) : skillsError ? (
                        <div className="px-2 py-2 text-xs text-error">{skillsError}</div>
                      ) : filteredSkills.length === 0 ? (
                        <div className="px-2 py-2 text-xs text-text-tertiary">没有匹配的技能</div>
                      ) : (
                        filteredSkills.map((skill) => {
                          const checked = selectedSkillKeys.includes(skill.skillKey);
                          const unavailable = skill.disabled || !skill.eligible;
                          return (
                            <button
                              key={skill.skillKey}
                              type="button"
                              disabled={disabled || unavailable}
                              onClick={() => handleInsertSkill(skill.skillKey)}
                              className="w-full flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-background transition-colors disabled:opacity-50"
                              title={`/${skill.skillKey}`}
                            >
                              <div className="min-w-0">
                                <div className="text-sm text-text-primary truncate">
                                  {skill.name}
                                </div>
                                <div className="text-[11px] text-text-tertiary truncate">
                                  /{skill.skillKey}
                                </div>
                                {skill.description && (
                                  <div className="text-[11px] text-text-tertiary/90 truncate mt-0.5">
                                    {skill.description}
                                  </div>
                                )}
                                {unavailable && (
                                  <div className="text-[10px] text-text-tertiary mt-0.5">
                                    当前不可用
                                  </div>
                                )}
                              </div>
                              {checked && (
                                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border-light">
                      <button
                        type="button"
                        onClick={() => {
                          setSkillsOpen(false);
                          openSettings("skills");
                        }}
                        className="w-full rounded-md px-2 py-1.5 text-left text-xs text-primary hover:bg-primary/10"
                      >
                        管理 Skills
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover open={connectorsOpen} onOpenChange={setConnectorsOpen}>
                  <PopoverTrigger asChild>
                    <button
                      disabled={disabled}
                      className="relative p-sm rounded-lg hover:bg-background text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="选择连接器"
                    >
                      <Plug className="w-5 h-5" />
                      {activeConnectorIds.length > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[11px] leading-[18px] text-center">
                          {activeConnectorIds.length}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    side="bottom"
                    sideOffset={8}
                    className="w-[320px] p-2 rounded-xl border-border-light bg-surface shadow-xl"
                  >
                    <div className="px-2 pb-2 text-xs text-text-tertiary border-b border-border-light">
                      已连接 {connectedConnectors.length} 个，当前会话启用{" "}
                      {activeConnectorIds.length} 个
                    </div>
                    <div className="max-h-64 overflow-auto py-1 space-y-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border">
                      {connectedConnectors.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-text-tertiary">暂无可用连接器</div>
                      ) : (
                        connectedConnectors.map((connector) => {
                          const checked = activeConnectorIds.includes(connector.id);
                          return (
                            <label
                              key={connector.id}
                              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-background cursor-pointer"
                            >
                              <span className="text-sm text-text-primary truncate">
                                {connector.name}
                              </span>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  onToggleConnector?.(connector.id, event.target.checked)
                                }
                                className="h-4 w-4"
                              />
                            </label>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-border-light">
                      <button
                        type="button"
                        onClick={() => {
                          setConnectorsOpen(false);
                          openSettings("connectors");
                        }}
                        className="w-full rounded-md px-2 py-1.5 text-left text-xs text-primary hover:bg-primary/10"
                      >
                        管理 Connectors
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-xs">
                {/* @ + / 合并 */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      disabled={disabled}
                      className="p-sm rounded-lg hover:bg-background text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="@ 提及与 / 命令"
                    >
                      <AtSign className="w-5 h-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" side="top" className="w-44 p-1.5">
                    <button
                      type="button"
                      onClick={() => handleInsertMentionOrCommand("@ ")}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-background"
                    >
                      插入 @ 提及
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInsertMentionOrCommand("/ ")}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-background"
                    >
                      插入 / 命令
                    </button>
                  </PopoverContent>
                </Popover>

                {/* 文件上传 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="p-sm rounded-lg hover:bg-background text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传文件 (最大10MB)"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* 图片上传 */}
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={disabled}
                  className="p-sm rounded-lg hover:bg-background text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传图片"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* 语音输入 (占位) */}
                <button
                  disabled
                  className="p-sm rounded-lg text-text-tertiary opacity-50 cursor-not-allowed"
                  title="语音输入 (即将推出)"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* 发送按钮 */}
                <button
                  onClick={handleSend}
                  disabled={
                    disabled || isSending || (!inputValue.trim() && attachmentValue.length === 0)
                  }
                  className="p-sm rounded-lg bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="发送 (Enter)"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="text-[11px] text-text-tertiary px-xs">
              Connectors: 已连接 {connectedConnectors.length} 个，当前会话启用{" "}
              {activeConnectorIds.length} 个
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
