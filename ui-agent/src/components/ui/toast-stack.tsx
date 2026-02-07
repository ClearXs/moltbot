"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/stores/toastStore";

const variantStyles: Record<string, string> = {
  info: "border-border-light bg-background text-text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  error: "border-error/30 bg-error/10 text-error",
};

export function ToastStack() {
  const { toasts, removeToast } = useToastStore();

  useEffect(() => {
    const timers = toasts.map((toast) => {
      const duration = toast.durationMs ?? 5000;
      return window.setTimeout(() => {
        removeToast(toast.id);
      }, duration);
    });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-6 top-16 z-50 flex w-[320px] flex-col gap-sm">
      {toasts.map((toast) => {
        const variant = toast.variant ?? "info";
        return (
          <div
            key={toast.id}
            className={cn(
              "rounded-lg border px-4 py-3 shadow-lg backdrop-blur",
              variantStyles[variant],
            )}
          >
            <div className="flex items-start justify-between gap-sm">
              <div className="flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description && (
                  <p className="mt-1 text-xs text-text-secondary">{toast.description}</p>
                )}
              </div>
              <button
                className="text-text-tertiary hover:text-text-primary"
                onClick={() => removeToast(toast.id)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {toast.action && (
              <button
                className="mt-2 text-xs font-medium text-primary hover:underline"
                onClick={() => {
                  toast.action?.onClick();
                  removeToast(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
