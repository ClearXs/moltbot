"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredDeviceIdentity, resetDeviceIdentity } from "@/lib/gateway/device-identity";
import { useConnectionStore } from "@/store/connection";

export default function SettingsGateway() {
  const {
    status,
    lastError,
    lastConnectedAt,
    gatewayToken,
    gatewayUrl,
    pairingRequestId,
    pairingDeviceId,
    connect,
    disconnect,
    setGatewayToken,
    setGatewayUrl,
    clearPairingRequest,
  } = useConnectionStore();

  const [tokenInput, setTokenInput] = useState(gatewayToken);
  const [urlInput, setUrlInput] = useState(gatewayUrl);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    setTokenInput(gatewayToken);
  }, [gatewayToken]);

  useEffect(() => {
    setUrlInput(gatewayUrl);
  }, [gatewayUrl]);

  useEffect(() => {
    const stored = getStoredDeviceIdentity();
    setDeviceId(stored?.deviceId ?? null);
  }, [status]);

  const deviceIdShort = useMemo(() => {
    if (!deviceId) {
      return "未生成";
    }
    return `${deviceId.slice(0, 6)}…${deviceId.slice(-4)}`;
  }, [deviceId]);

  const connectedAtText = useMemo(() => {
    if (!lastConnectedAt) {
      return "—";
    }
    return new Date(lastConnectedAt).toLocaleString();
  }, [lastConnectedAt]);

  const statusText =
    status === "connected"
      ? "已连接"
      : status === "connecting"
        ? "连接中..."
        : status === "error"
          ? "连接错误"
          : "未连接";

  const statusColor =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
        ? "bg-yellow-500"
        : status === "error"
          ? "bg-red-500"
          : "bg-gray-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
        <span className="text-sm">{statusText}</span>
        {pairingRequestId && (
          <Badge variant="secondary">
            配对待批准 {pairingDeviceId ? `(${pairingDeviceId.slice(0, 6)}…)` : ""}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Gateway WebSocket 地址</div>
        <Input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="ws://127.0.0.1:18789"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setGatewayUrl(urlInput);
              toast.success("Gateway 地址已保存");
            }}
          >
            保存地址
          </Button>
          <Button variant="ghost" onClick={() => setUrlInput(gatewayUrl)}>
            重置
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Gateway Token</div>
        <Input
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="输入 gateway token"
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setGatewayToken(tokenInput);
              toast.success("Gateway Token 已保存");
            }}
          >
            保存 Token
          </Button>
          <Button variant="ghost" onClick={() => setTokenInput(gatewayToken)}>
            重置
          </Button>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">设备 ID</span>
          <span>{deviceIdShort}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">最近连接</span>
          <span>{connectedAtText}</span>
        </div>
        {lastError && (
          <div className="rounded-md bg-red-50 p-2 text-xs text-red-600">{lastError}</div>
        )}
      </div>

      {pairingRequestId && (
        <div className="space-y-2 text-sm">
          <div className="text-muted-foreground">设备配对命令</div>
          <div className="flex flex-col gap-2">
            <code className="rounded bg-muted px-2 py-1 text-xs">
              openclaw devices approve {pairingRequestId}
            </code>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(`openclaw devices approve ${pairingRequestId}`);
                clearPairingRequest();
                toast.success("已复制配对命令");
              }}
            >
              复制命令
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => connect()} disabled={status === "connecting"}>
          连接 Gateway
        </Button>
        <Button variant="outline" onClick={() => disconnect()}>
          断开连接
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            resetDeviceIdentity();
            toast.success("已重置设备身份，请重新连接");
          }}
        >
          重置设备身份
        </Button>
      </div>
    </div>
  );
}
