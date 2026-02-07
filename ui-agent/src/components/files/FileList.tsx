"use client";

import { FileText, Download, ExternalLink } from "lucide-react";
import {
  FaFilePdf,
  FaFileWord,
  FaFileExcel,
  FaFilePowerpoint,
  FaFileAlt,
  FaFileImage,
  FaFileArchive,
  FaFolder,
} from "react-icons/fa";

export interface FileItemProps {
  name: string;
  path: string;
  size?: string;
  type?: "pdf" | "docx" | "xlsx" | "md" | "pptx" | "png" | "jpg" | "zip";
  description?: string;
}

export function FileItem({ name, path, size, type = "md", description }: FileItemProps) {
  const getFileIcon = () => {
    const iconClassName = "w-6 h-6";

    switch (type) {
      case "pdf":
        return <FaFilePdf className={`${iconClassName} text-error`} />;
      case "docx":
        return <FaFileWord className={`${iconClassName} text-[#2B579A]`} />;
      case "xlsx":
        return <FaFileExcel className={`${iconClassName} text-[#217346]`} />;
      case "pptx":
        return <FaFilePowerpoint className={`${iconClassName} text-[#D24726]`} />;
      case "md":
        return <FaFileAlt className={`${iconClassName} text-text-secondary`} />;
      case "png":
      case "jpg":
        return <FaFileImage className={`${iconClassName} text-primary`} />;
      case "zip":
        return <FaFileArchive className={`${iconClassName} text-warning`} />;
      default:
        return <FaFolder className={`${iconClassName} text-text-tertiary`} />;
    }
  };

  const handleView = () => {
    window.open(path, "_blank");
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = path;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex items-center gap-sm p-sm rounded border border-border-light hover:border-primary hover:bg-primary/5 transition-all group">
      {/* 文件图标 */}
      <div className="flex-shrink-0">{getFileIcon()}</div>

      {/* 文件信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-xs">
          <span className="text-sm font-medium text-text-primary truncate">{name}</span>
          {size && <span className="text-xs text-text-tertiary flex-shrink-0">({size})</span>}
        </div>
        {description && <p className="text-xs text-text-tertiary mt-xs truncate">{description}</p>}
      </div>

      {/* 操作按钮 */}
      <div className="flex-shrink-0 flex items-center gap-xs opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleView}
          className="p-xs rounded hover:bg-primary/10 text-primary transition-colors"
          title="查看文件"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
        <button
          onClick={handleDownload}
          className="p-xs rounded hover:bg-primary/10 text-primary transition-colors"
          title="下载文件"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface FileListProps {
  files: FileItemProps[];
  title?: string;
}

export function FileList({ files, title }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mt-md">
      {title && (
        <h4 className="text-sm font-semibold text-text-primary mb-sm flex items-center gap-xs">
          <FileText className="w-4 h-4" />
          {title}
        </h4>
      )}
      <div className="space-y-xs">
        {files.map((file, index) => (
          <FileItem key={index} {...file} />
        ))}
      </div>
    </div>
  );
}
