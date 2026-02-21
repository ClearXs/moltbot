"use client";

import {
  Zap,
  Plus,
  Upload,
  Github,
  Globe,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  AlertTriangle,
  RefreshCcw,
  Download,
  ChevronDown,
  ExternalLink,
  Search,
  FileText,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useConnectionStore } from "@/stores/connectionStore";
import { useToastStore } from "@/stores/toastStore";

/* ------------------------------------------------------------------ */
/*  Types matching the backend skills API                                */
/* ------------------------------------------------------------------ */

interface SkillInstallOption {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

interface SkillStatusEntry {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    anyBins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  install: SkillInstallOption[];
}

interface SkillStatusReport {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
}

/* ------------------------------------------------------------------ */
/*  Source badge                                                          */
/* ------------------------------------------------------------------ */

function SourceBadge({ source }: { source: string }) {
  const variants: Record<string, { bg: string; text: string; label: string }> = {
    "openclaw-workspace": { bg: "bg-green-100", text: "text-green-700", label: "工作区" },
    "openclaw-bundled": { bg: "bg-blue-100", text: "text-blue-700", label: "内置" },
    "openclaw-installed": { bg: "bg-amber-100", text: "text-amber-700", label: "已安装" },
    "openclaw-extra": { bg: "bg-purple-100", text: "text-purple-700", label: "扩展" },
  };
  const v = variants[source] ?? { bg: "bg-gray-100", text: "text-gray-600", label: source };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${v.bg} ${v.text}`}>
      {v.label}
    </span>
  );
}


/* ------------------------------------------------------------------ */
/*  Skill Code Preview Dialog                                            */
/* ------------------------------------------------------------------ */

function SkillCodePreviewDialog({
  open,
  skill,
  onClose,
}: {
  open: boolean;
  skill: SkillStatusEntry | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsClient = useConnectionStore((s) => s.wsClient);

  useEffect(() => {
    if (!open || !skill || !wsClient) {
      setContent(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    wsClient
      .sendRequest<{ content: string; files?: string[] }>("skills.getCode", {
        skillKey: skill.skillKey,
        filePath: "SKILL.md",
      })
      .then((result) => {
        setContent(result?.content ?? "无法读取 SKILL.md 内容");
      })
      .catch(() => {
        setError("无法加载 Skill 代码预览 (skills.getCode API 可能未实现)");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, skill, wsClient]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {skill?.emoji && <span>{skill.emoji}</span>}
            {skill?.name ?? "Skill"} - SKILL.md
          </DialogTitle>
          <DialogDescription>
            查看 Skill 定义文件,了解其功能和指令内容。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-md border border-border-light bg-surface-subtle">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-text-tertiary animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <AlertCircle className="w-8 h-8 text-text-tertiary mb-3" />
              <p className="text-sm text-text-primary mb-1">预览不可用</p>
              <p className="text-xs text-text-tertiary">{error}</p>
              {skill?.filePath && (
                <p className="text-xs text-text-tertiary mt-2 font-mono">
                  文件路径: {skill.filePath}
                </p>
              )}
            </div>
          ) : (
            <pre className="p-4 text-xs text-text-primary overflow-auto h-full whitespace-pre-wrap break-words font-mono leading-relaxed">
              {content}
            </pre>
          )}
        </div>

        <DialogFooter>
          {skill?.homepage && (
            <a
              href={skill.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 mr-auto"
            >
              <ExternalLink className="w-3 h-3" />
              文档
            </a>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* ------------------------------------------------------------------ */
/*  Skill card                                                           */
/* ------------------------------------------------------------------ */

function SkillCard({
  skill,
  onToggle,
  onInstall,
  onSetApiKey,
  onPreviewCode,
}: {
  skill: SkillStatusEntry;
  onToggle: (skillKey: string, enabled: boolean) => void;
  onInstall: (skillName: string, installId: string) => void;
  onSetApiKey: (skillKey: string, envKey: string, value: string) => void;
  onPreviewCode: (skill: SkillStatusEntry) => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");

  const hasMissing =
    skill.missing.bins.length > 0 ||
    skill.missing.env.length > 0 ||
    skill.missing.config.length > 0 ||
    skill.missing.os.length > 0;

  return (
    <div className="border border-border-light rounded-lg p-4 hover:border-border transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {skill.emoji && (
            <span className="text-lg flex-shrink-0 mt-0.5">{skill.emoji}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-text-primary">{skill.name}</span>
              <SourceBadge source={skill.source} />
              {skill.always && (
                <span className="text-[10px] text-text-tertiary bg-surface-subtle px-1.5 py-0.5 rounded">
                  常驻
                </span>
              )}
            </div>
            <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{skill.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Preview code button */}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-text-tertiary hover:text-text-primary"
            onClick={() => onPreviewCode(skill)}
            title="查看 SKILL.md"
          >
            <FileText className="w-3.5 h-3.5" />
          </Button>

          {/* Toggle */}
          <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!skill.disabled}
            onChange={(e) => onToggle(skill.skillKey, e.target.checked)}
            disabled={!skill.eligible || skill.blockedByAllowlist}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary peer-disabled:opacity-40" />
        </label>
      </div>

      {/* Missing deps warning */}
      {hasMissing && (
        <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 space-y-0.5">
              {skill.missing.bins.length > 0 && (
                <div>缺少程序: {skill.missing.bins.join(", ")}</div>
              )}
              {skill.missing.env.length > 0 && (
                <div>缺少环境变量: {skill.missing.env.join(", ")}</div>
              )}
              {skill.missing.config.length > 0 && (
                <div>缺少配置: {skill.missing.config.join(", ")}</div>
              )}
              {skill.missing.os.length > 0 && (
                <div>不支持当前操作系统</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* API Key input */}
      {skill.primaryEnv && (
        <div className="mt-3">
          <label className="text-xs text-text-tertiary mb-1 block">{skill.primaryEnv}</label>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={`输入 ${skill.primaryEnv}`}
                className="h-7 text-xs pr-7"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
              >
                {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs px-2"
              onClick={() => {
                if (apiKeyInput.trim()) {
                  onSetApiKey(skill.skillKey, skill.primaryEnv!, apiKeyInput.trim());
                  setApiKeyInput("");
                }
              }}
              disabled={!apiKeyInput.trim()}
            >
              保存
            </Button>
          </div>
        </div>
      )}

      {/* Install options */}
      {skill.install.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {skill.install.map((opt) => (
            <Button
              key={opt.id}
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onInstall(skill.name, opt.id)}
            >
              <Download className="w-3 h-3 mr-1" />
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {/* Footer: homepage link */}
      {skill.homepage && (
        <div className="mt-3 pt-2 border-t border-border-light">
          <a
            href={skill.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            查看文档
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Install confirm dialog                                               */
/* ------------------------------------------------------------------ */

function InstallConfirmDialog({
  open,
  title,
  source,
  description,
  isInstalling,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  source: string;
  description: string;
  isInstalling: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>确认安装 Skill?</DialogTitle>
          <DialogDescription>
            即将安装 <strong>{title}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {description && (
            <p className="text-sm text-text-secondary">{description}</p>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 space-y-1">
                <p className="font-semibold">安全提示</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>仅从可信来源安装 Skills</li>
                  <li>安装前请检查 Skill 代码和作者声誉</li>
                  <li>Skills 可能执行系统命令或访问文件</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-xs text-text-tertiary">
            来源: <SourceBadge source={source} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isInstalling}>
            取消
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={isInstalling}>
            {isInstalling ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                安装中...
              </>
            ) : (
              "确认安装"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  GitHub install dialog                                                */
/* ------------------------------------------------------------------ */

function GitHubInstallDialog({
  open,
  onClose,
  onInstall,
}: {
  open: boolean;
  onClose: () => void;
  onInstall: (url: string) => void;
}) {
  const [url, setUrl] = useState("");

  const isValid = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(url);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>从 GitHub 安装 Skill</DialogTitle>
          <DialogDescription>
            输入包含 SKILL.md 的 GitHub 仓库 URL
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/user/repo"
            className="h-9 text-sm"
            autoFocus
          />
          {url && !isValid && (
            <p className="text-xs text-error">请输入有效的 GitHub 仓库 URL</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onInstall(url);
              setUrl("");
            }}
            disabled={!isValid}
          >
            <Github className="w-3.5 h-3.5 mr-1.5" />
            安装
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Local Upload Dialog                                                  */
/* ------------------------------------------------------------------ */

function LocalUploadDialog({
  open,
  onClose,
  onUpload,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (skillName: string, skillMdContent: string, files: File[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [skillMdContent, setSkillMdContent] = useState<string | null>(null);
  const [skillName, setSkillName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setSkillMdContent(null);
    setSkillName("");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFilesSelected = async (fileList: FileList) => {
    const fileArray = Array.from(fileList);
    setFiles(fileArray);
    setError(null);

    const skillMdFile = fileArray.find(
      (f) => f.name === "SKILL.md" || f.webkitRelativePath.endsWith("/SKILL.md")
    );

    if (!skillMdFile) {
      setError("所选文件夹中未找到 SKILL.md 文件。Skill 必须包含 SKILL.md 定义文件。");
      setSkillMdContent(null);
      setSkillName("");
      return;
    }

    try {
      const text = await skillMdFile.text();
      setSkillMdContent(text);
      const nameMatch = text.match(/^---[\s\S]*?name:\s*(.+?)[\s\r\n]/m);
      if (nameMatch) {
        setSkillName(nameMatch[1].trim());
      } else {
        const parts = skillMdFile.webkitRelativePath.split("/");
        setSkillName(parts.length > 1 ? parts[0] : "my-skill");
      }
    } catch {
      setError("无法读取 SKILL.md 文件内容");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>上传本地 Skill</DialogTitle>
          <DialogDescription>选择包含 SKILL.md 的文件夹</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              /* @ts-expect-error webkitdirectory is a non-standard attribute */
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  void handleFilesSelected(e.target.files);
                }
              }}
            />
            <Button
              variant="outline"
              className="w-full h-20 border-dashed border-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-1">
                <Upload className="w-5 h-5 text-text-tertiary" />
                <span className="text-xs text-text-tertiary">
                  {files.length > 0
                    ? \`已选择 \${files.length} 个文件\`
                    : "点击选择 Skill 文件夹"}
                </span>
              </div>
            </Button>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-700 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                {error}
              </p>
            </div>
          )}

          {skillMdContent && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Skill 名称</label>
                <Input
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">SKILL.md 预览</label>
                <pre className="p-3 bg-surface-subtle rounded-md text-xs text-text-primary max-h-[200px] overflow-auto whitespace-pre-wrap break-words font-mono">
                  {skillMdContent.slice(0, 2000)}
                  {skillMdContent.length > 2000 && "\n\n... (内容已截断)"}
                </pre>
              </div>
              <p className="text-xs text-text-tertiary">
                共 {files.length} 个文件
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => { reset(); onClose(); }}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (skillMdContent && skillName.trim()) {
                onUpload(skillName.trim(), skillMdContent, files);
                reset();
              }
            }}
            disabled={!skillMdContent || !skillName.trim()}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            上传
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  ClawHub browse dialog                                                */
/* ------------------------------------------------------------------ */

function ClawHubDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>从 ClawHub 浏览 Skills</DialogTitle>
          <DialogDescription>
            搜索并安装社区 Skills
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Globe className="w-12 h-12 text-text-tertiary mb-4" />
          <p className="text-sm text-text-primary mb-2">ClawHub 集成</p>
          <p className="text-xs text-text-tertiary max-w-sm mb-4">
            正在接入 clawhub.ai 社区 Skills 注册表,完成后可直接搜索并安装社区共享的 Skills。
          </p>
          <a
            href="https://clawhub.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            访问 ClawHub.ai
          </a>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                       */
/* ------------------------------------------------------------------ */

export function SkillsTab() {
  const { addToast } = useToastStore();
  const wsClient = useConnectionStore((s) => s.wsClient);

  // State
  const [status, setStatus] = useState<SkillStatusReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [clawhubOpen, setClawhubOpen] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<SkillStatusEntry | null>(null);
  const [confirmInstall, setConfirmInstall] = useState<{
    title: string;
    source: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  // Load skills status
  const loadSkills = useCallback(async () => {
    if (!wsClient) {
      setError("未连接到网关");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await wsClient.sendRequest<SkillStatusReport>("skills.status", {});
      setStatus(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 Skills 失败");
    } finally {
      setIsLoading(false);
    }
  }, [wsClient]);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  // Toggle skill enabled/disabled
  const handleToggle = useCallback(
    async (skillKey: string, enabled: boolean) => {
      if (!wsClient) return;
      try {
        await wsClient.sendRequest("skills.update", { skillKey, enabled });
        addToast({
          title: enabled ? "已启用" : "已禁用",
          description: `Skill "${skillKey}" 已${enabled ? "启用" : "禁用"}`,
        });
        void loadSkills();
      } catch (err) {
        addToast({
          title: "操作失败",
          description: err instanceof Error ? err.message : "更新失败",
          variant: "error",
        });
      }
    },
    [wsClient, addToast, loadSkills],
  );

  // Install a skill binary dependency
  const handleInstall = useCallback(
    (skillName: string, installId: string) => {
      setConfirmInstall({
        title: `${skillName} - ${installId}`,
        source: "openclaw-bundled",
        description: `为 "${skillName}" 安装依赖组件 (${installId})`,
        action: async () => {
          if (!wsClient) return;
          const result = await wsClient.sendRequest<{ ok: boolean; message: string }>(
            "skills.install",
            { name: skillName, installId, timeoutMs: 60000 },
          );
          if (result?.ok) {
            addToast({ title: "安装成功", description: result.message || "依赖已安装" });
          } else {
            throw new Error(result?.message || "安装失败");
          }
        },
      });
    },
    [wsClient, addToast],
  );

  // Set API key for a skill
  const handleSetApiKey = useCallback(
    async (skillKey: string, envKey: string, value: string) => {
      if (!wsClient) return;
      try {
        await wsClient.sendRequest("skills.update", {
          skillKey,
          env: { [envKey]: value },
        });
        addToast({
          title: "API Key 已保存",
          description: `${envKey} 已更新`,
        });
        void loadSkills();
      } catch (err) {
        addToast({
          title: "保存失败",
          description: err instanceof Error ? err.message : "API Key 保存失败",
          variant: "error",
        });
      }
    },
    [wsClient, addToast, loadSkills],
  );

  // GitHub install
  const handleGitHubInstall = useCallback(
    (url: string) => {
      setGithubOpen(false);
      setConfirmInstall({
        title: url.split("/").slice(-2).join("/"),
        source: "github",
        description: `从 GitHub 安装 Skill: ${url}`,
        action: async () => {
          if (!wsClient) return;
          // Use skills.install with a github-specific convention
          await wsClient.sendRequest("skills.install", {
            name: url,
            installId: "github",
            timeoutMs: 120000,
          });
          addToast({
            title: "安装成功",
            description: "Skill 已从 GitHub 安装",
          });
        },
      });
    },
    [wsClient, addToast],
  );

  // Local upload
  const handleLocalUpload = useCallback(
    (skillName: string, skillMdContent: string, files: File[]) => {
      setUploadOpen(false);
      setConfirmInstall({
        title: skillName,
        source: "local-upload",
        description: \`上传本地 Skill "\${skillName}" (\${files.length} 个文件)\`,
        action: async () => {
          if (!wsClient) return;
          try {
            await wsClient.sendRequest("skills.upload", {
              name: skillName,
              skillMd: skillMdContent,
              timeoutMs: 60000,
            });
            addToast({
              title: "上传成功",
              description: \`Skill "\${skillName}" 已上传\`,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg.includes("not found") || msg.includes("unknown method") || msg.includes("not implemented")) {
              throw new Error(
                \`后端暂不支持通过 WebSocket 上传 Skill。请将 Skill 文件夹手动复制到 \${status?.managedSkillsDir ?? "~/.openclaw/skills/"} 目录下,然后刷新 Skills 列表。\`
              );
            }
            throw err;
          }
        },
      });
    },
    [wsClient, addToast, status?.managedSkillsDir],
  );

  // Confirm install action
  const handleConfirmInstall = async () => {
    if (!confirmInstall) return;
    setIsInstalling(true);
    try {
      await confirmInstall.action();
      void loadSkills();
    } catch (err) {
      addToast({
        title: "安装失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "error",
      });
    } finally {
      setIsInstalling(false);
      setConfirmInstall(null);
    }
  };

  // Filter skills
  const filteredSkills = status?.skills.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.skillKey.toLowerCase().includes(q)
    );
  }) ?? [];

  // Group skills by source
  const grouped = {
    workspace: filteredSkills.filter((s) => s.source === "openclaw-workspace"),
    bundled: filteredSkills.filter((s) => s.source === "openclaw-bundled"),
    installed: filteredSkills.filter((s) => s.source === "openclaw-installed" || s.source === "openclaw-extra"),
    other: filteredSkills.filter(
      (s) => !["openclaw-workspace", "openclaw-bundled", "openclaw-installed", "openclaw-extra"].includes(s.source),
    ),
  };

  // Loading state
  if (isLoading && !status) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 text-text-tertiary animate-spin mb-3" />
        <p className="text-sm text-text-tertiary">加载 Skills...</p>
      </div>
    );
  }

  // Error state
  if (error && !status) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
        <AlertCircle className="w-10 h-10 text-error mb-3" />
        <p className="text-sm text-text-primary mb-1">加载 Skills 失败</p>
        <p className="text-xs text-text-tertiary mb-4">{error}</p>
        <Button size="sm" variant="outline" onClick={() => void loadSkills()}>
          <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索 Skills..."
            className="h-8 text-xs pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => void loadSkills()}
            disabled={isLoading}
          >
            <RefreshCcw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                添加 Skill
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                上传本地 Skill
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGithubOpen(true)}>
                <Github className="w-4 h-4 mr-2" />
                从 GitHub 安装
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setClawhubOpen(true)}>
                <Globe className="w-4 h-4 mr-2" />
                从 ClawHub 浏览
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-text-tertiary">
        <span>共 {status?.skills.length ?? 0} 个 Skills</span>
        <span>已启用 {status?.skills.filter((s) => !s.disabled).length ?? 0}</span>
        <span>可用 {status?.skills.filter((s) => s.eligible).length ?? 0}</span>
      </div>

      {/* Skills list by group */}
      {filteredSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Zap className="w-10 h-10 text-text-tertiary mb-3" />
          <p className="text-sm text-text-primary mb-1">
            {searchQuery ? "未找到匹配的 Skills" : "暂无已安装的 Skills"}
          </p>
          <p className="text-xs text-text-tertiary">
            {searchQuery ? "尝试修改搜索关键词" : "点击 \"添加 Skill\" 开始安装"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.workspace.length > 0 && (
            <SkillGroup title="工作区 Skills" skills={grouped.workspace} onToggle={handleToggle} onInstall={handleInstall} onSetApiKey={handleSetApiKey} onPreviewCode={setPreviewSkill} />
          )}
          {grouped.bundled.length > 0 && (
            <SkillGroup title="内置 Skills" skills={grouped.bundled} onToggle={handleToggle} onInstall={handleInstall} onSetApiKey={handleSetApiKey} onPreviewCode={setPreviewSkill} />
          )}
          {grouped.installed.length > 0 && (
            <SkillGroup title="已安装 Skills" skills={grouped.installed} onToggle={handleToggle} onInstall={handleInstall} onSetApiKey={handleSetApiKey} onPreviewCode={setPreviewSkill} />
          )}
          {grouped.other.length > 0 && (
            <SkillGroup title="其他 Skills" skills={grouped.other} onToggle={handleToggle} onInstall={handleInstall} onSetApiKey={handleSetApiKey} onPreviewCode={setPreviewSkill} />
          )}
        </div>
      )}

      {/* Dialogs */}
      <LocalUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUpload={handleLocalUpload}
      />

      <GitHubInstallDialog
        open={githubOpen}
        onClose={() => setGithubOpen(false)}
        onInstall={handleGitHubInstall}
      />

      <ClawHubDialog
        open={clawhubOpen}
        onClose={() => setClawhubOpen(false)}
      />

      <SkillCodePreviewDialog
        open={previewSkill !== null}
        skill={previewSkill}
        onClose={() => setPreviewSkill(null)}
      />

      <InstallConfirmDialog
        open={confirmInstall !== null}
        title={confirmInstall?.title ?? ""}
        source={confirmInstall?.source ?? ""}
        description={confirmInstall?.description ?? ""}
        isInstalling={isInstalling}
        onConfirm={handleConfirmInstall}
        onCancel={() => setConfirmInstall(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skill group                                                          */
/* ------------------------------------------------------------------ */

function SkillGroup({
  title,
  skills,
  onToggle,
  onInstall,
  onSetApiKey,
  onPreviewCode,
}: {
  title: string;
  skills: SkillStatusEntry[];
  onToggle: (skillKey: string, enabled: boolean) => void;
  onInstall: (skillName: string, installId: string) => void;
  onSetApiKey: (skillKey: string, envKey: string, value: string) => void;
  onPreviewCode: (skill: SkillStatusEntry) => void;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
        {title} ({skills.length})
      </h4>
      <div className="grid gap-3">
        {skills.map((skill) => (
          <SkillCard
            key={skill.skillKey}
            skill={skill}
            onToggle={onToggle}
            onInstall={onInstall}
            onSetApiKey={onSetApiKey}
            onPreviewCode={onPreviewCode}
          />
        ))}
      </div>
    </div>
  );
}
