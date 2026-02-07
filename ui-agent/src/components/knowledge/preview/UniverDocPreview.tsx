"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Download } from "lucide-react";

interface UniverDocPreviewProps {
  fileUrl: string;
  onError?: (error: Error) => void;
}

export function UniverDocPreview({ fileUrl, onError }: UniverDocPreviewProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟短暂加载后显示不支持提示
    const timer = setTimeout(() => {
      setLoading(false);
      const err = new Error("DOCX preview not yet supported");
      onError?.(err);
    }, 500);

    return () => clearTimeout(timer);
  }, [fileUrl, onError]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">正在准备文档...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <AlertCircle className="h-12 w-12 text-muted-foreground" />
      <div className="text-center space-y-2">
        <p className="text-base font-medium">DOCX 预览功能开发中</p>
        <p className="text-sm text-muted-foreground max-w-md">
          Word 文档预览需要额外的文档解析库支持。<br />
          目前请下载文件后使用本地应用查看。
        </p>
      </div>
      <a
        href={fileUrl}
        download
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Download className="h-4 w-4" />
        下载文件
      </a>
    </div>
  );
}
