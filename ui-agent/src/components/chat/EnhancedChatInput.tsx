"use client";

import { Send, Paperclip, Image as ImageIcon, Mic, AtSign, Command } from "lucide-react";
import { useState, useRef, KeyboardEvent } from "react";

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
}: EnhancedChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const inputValue = draftValue ?? input;
  const attachmentValue = draftAttachments ?? attachments;

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
    if (onDraftChange) {
      onDraftChange(e.target.value);
    } else {
      setInput(e.target.value);
    }
    if (sendError) setSendError(null);
    adjustTextareaHeight();
  };

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
            className={`flex items-end gap-sm border border-border transition-shadow ${
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
                style={{ maxHeight: "200px", minHeight: "60px" }}
              />
            </div>

            {/* 工具按钮 - 底部对齐 */}
            <div className="flex items-center gap-xs pb-xs">
              {/* @ 提及 */}
              <button
                disabled={disabled}
                className="p-xs rounded hover:bg-background-secondary text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="@ 提及助手"
              >
                <AtSign className="w-4 h-4" />
              </button>

              {/* / 命令 */}
              <button
                disabled={disabled}
                className="p-xs rounded hover:bg-background-secondary text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="/ 快捷命令"
              >
                <Command className="w-4 h-4" />
              </button>

              {/* 文件上传 */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="p-xs rounded hover:bg-background-secondary text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="上传文件 (最大10MB)"
              >
                <Paperclip className="w-4 h-4" />
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
                className="p-xs rounded hover:bg-background-secondary text-text-tertiary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="上传图片"
              >
                <ImageIcon className="w-4 h-4" />
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
                className="p-xs rounded text-text-tertiary opacity-50 cursor-not-allowed"
                title="语音输入 (即将推出)"
              >
                <Mic className="w-4 h-4" />
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
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
