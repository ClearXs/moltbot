"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useConnectionStore } from "@/store/connection";

export function GatewayConnectionNotifier() {
  const { status, lastError, connect, pairingRequestId, clearPairingRequest } =
    useConnectionStore();

  useEffect(() => {
    if (status === "disconnected") {
      void connect();
    }
  }, [status, connect]);

  useEffect(() => {
    if (!lastError) {
      return;
    }
    const normalized = lastError.toLowerCase();
    if (normalized.includes("gateway token")) {
      toast.error("需要 Gateway Token", {
        description: "当前连接需要 gateway token。",
      });
      return;
    }
    toast.error("连接失败", {
      description: lastError,
    });
  }, [lastError]);

  useEffect(() => {
    if (!pairingRequestId) {
      return;
    }
    const command = `openclaw devices approve ${pairingRequestId}`;
    toast.warning("设备配对请求", {
      description: "需要在网关主机批准设备配对。",
      action: {
        label: "复制命令",
        onClick: () => {
          void navigator.clipboard?.writeText(command);
          clearPairingRequest();
        },
      },
    });
  }, [pairingRequestId, clearPairingRequest]);

  return null;
}
