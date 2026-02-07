import { History, Loader2, MessageSquare, Mic, MicOff, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { callGateway, callGatewayFinal } from "@/services/gateway";
import { getDefaultAgentId } from "@/services/personas";
import LiveKit from "./voices/livekit";
import useRecorder from "./voices/record";
import useSpeakApi from "./voices/speak";
import { useViewer } from "./vrm/viewerContext";

type ToolsProps = {
  liveKit: LiveKit;
};

export default function Tools({ liveKit }: ToolsProps) {
  const { start, stop, analyserRef } = useRecorder();
  const [recording, setRecording] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textMessage, setTextMessage] = useState("");
  const [textLoading, setTextLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<
    Array<{ role?: string; content?: unknown; text?: string; timestamp?: number }>
  >([]);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLimit, setHistoryLimit] = useState(50);

  const waveCanvasRef = useRef<HTMLCanvasElement | undefined>(undefined);
  const waveRenderRef = useRef<CanvasRenderingContext2D | undefined>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const animationFrameRef = useRef<number | undefined>(undefined);

  const speakApi = useSpeakApi();
  const viewer = useViewer();

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);

      liveKit.addOnClose(() => {
        setRecording(false);
      });

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
    };
  }, [liveKit]);

  useEffect(() => {
    const ensureSessionKey = async () => {
      if (sessionKey) {
        return;
      }
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem("openclaw.ui-avatar.sessionKey")
          : null;
      if (stored) {
        setSessionKey(stored);
        return;
      }
      const agentId = await getDefaultAgentId();
      const next = `agent:${agentId}:ui-avatar`;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("openclaw.ui-avatar.sessionKey", next);
      }
      setSessionKey(next);
    };
    void ensureSessionKey();
  }, [sessionKey]);

  const loadHistory = useCallback(
    async (key: string, limitOverride?: number) => {
      try {
        setHistoryLoading(true);
        const limitValue = limitOverride ?? historyLimit;
        const payload = await callGateway<{
          messages?: Array<{
            role?: string;
            content?: unknown;
            text?: string;
            timestamp?: number;
          }>;
        }>("chat.history", { sessionKey: key, limit: limitValue });
        setHistoryMessages(payload.messages ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载聊天记录失败");
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyLimit],
  );

  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !waveRenderRef.current || !waveCanvasRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    waveRenderRef.current.clearRect(
      0,
      0,
      waveCanvasRef.current.width / (window.devicePixelRatio || 1),
      waveCanvasRef.current.height / (window.devicePixelRatio || 1),
    );
    waveRenderRef.current.lineWidth = 0.5;
    waveRenderRef.current.strokeStyle = getWaveStroke();
    waveRenderRef.current.beginPath();

    const sliceWidth = waveCanvasRef.current.width / (window.devicePixelRatio || 1) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * (waveCanvasRef.current.height / (window.devicePixelRatio || 1))) / 2;

      if (i === 0) {
        waveRenderRef.current.moveTo(x, y);
      } else {
        waveRenderRef.current.lineTo(x, y);
      }

      x += sliceWidth;
    }

    waveRenderRef.current.lineTo(
      waveCanvasRef.current.width / (window.devicePixelRatio || 1),
      waveCanvasRef.current.height / (window.devicePixelRatio || 1) / 2,
    );
    waveRenderRef.current.stroke();

    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  const getWaveStroke = useCallback(() => {
    const styles = getComputedStyle(document.documentElement);
    const v = styles.getPropertyValue("--primary").trim();
    return v || "#fff";
  }, []);

  const sendVoice = useCallback(
    async (blob: Blob) => {
      const arrayBuffer = await blob.arrayBuffer();
      liveKit.sendMessage(arrayBuffer);
    },
    [liveKit],
  );

  const handleRecording = useCallback(async () => {
    if (recording) {
      await stop();

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }

      if (waveCanvasRef.current) {
        waveCanvasRef.current = undefined;
      }

      if (waveRenderRef.current) {
        waveRenderRef.current = undefined;
      }

      setRecording(false);
    } else {
      setRecording(true);

      await start(async (blob) => {
        await sendVoice(blob);
      });

      waveCanvasRef.current = document.getElementById("voice-wave");
      if (waveCanvasRef.current) {
        waveRenderRef.current = waveCanvasRef.current.getContext("2d");

        waveCanvasRef.current.width = 40 * (window.devicePixelRatio || 1);
        waveCanvasRef.current.height = 18 * (window.devicePixelRatio || 1);

        waveRenderRef.current!.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      }

      drawWaveform();
    }
  }, [recording, sendVoice, start, stop]);

  const handleToggleTextInput = useCallback(() => {
    setShowTextInput((prev) => !prev);
    if (showTextInput) {
      setTextMessage("");
    }
  }, [showTextInput]);

  const handleToggleHistory = useCallback(() => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && sessionKey) {
      void loadHistory(sessionKey);
    }
  }, [showHistory, sessionKey, loadHistory]);

  const handleKeyPress = useCallback(
    async (event: React.KeyboardEvent) => {
      if (event.key === "Enter" && !textLoading) {
        await sendTextMessage(textMessage);
      }
    },
    [textMessage, textLoading, sendTextMessage],
  );

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      setTextLoading(true);
      try {
        const isFinal = (payload: unknown) => {
          if (!payload || typeof payload !== "object") {
            return true;
          }
          if ("status" in payload) {
            return (payload as { status?: string }).status !== "accepted";
          }
          return true;
        };
        const agentId = await getDefaultAgentId();
        const key = sessionKey ?? `agent:${agentId}:ui-avatar`;
        if (!sessionKey) {
          setSessionKey(key);
          if (typeof window !== "undefined") {
            window.localStorage.setItem("openclaw.ui-avatar.sessionKey", key);
          }
        }
        const idempotencyKey =
          typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `msg-${Date.now()}`;
        const response = await callGatewayFinal<{
          status: string;
          result?: { payloads?: Array<{ text?: string }> };
        }>("agent", { message: text, agentId, idempotencyKey, sessionKey: key }, isFinal);
        const replyText =
          response.result?.payloads
            ?.map((payload) => payload.text ?? "")
            .filter(Boolean)
            .join("\n") ?? "";
        if (!replyText) {
          toast.error("Agent 没有返回文本");
          setTextLoading(false);
          return;
        }
        void loadHistory(key);
        speakApi.speak("neutral", viewer, replyText, undefined, () => {
          setTextMessage("");
          setTextLoading(false);
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "发送失败");
        setTextLoading(false);
      }
    },
    [speakApi, viewer, sessionKey, loadHistory],
  );

  const resolveMessageText = useCallback((message: { content?: unknown; text?: string }) => {
    if (typeof message.text === "string") {
      return message.text;
    }
    if (typeof message.content === "string") {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content
        .map((item) => {
          if (!item || typeof item !== "object") {
            return "";
          }
          const entry = item as { type?: string; text?: string };
          if (entry.type === "text" && entry.text) {
            return entry.text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }, []);

  const formatTimestamp = useCallback((timestamp?: number) => {
    if (!timestamp) {
      return "";
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString();
  }, []);

  const handleKeyboard = useCallback(
    async (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "x") {
        event.preventDefault();
        await handleRecording();
      }
    },
    [liveKit],
  );

  return (
    <div className="flex flex-col gap-2 items-center">
      {showHistory && (
        <Card className="w-[420px] max-w-[90vw] bg-white/90 backdrop-blur">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">聊天记录</div>
              <div className="text-xs text-gray-500">{sessionKey ?? "未设置会话"}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => sessionKey && void loadHistory(sessionKey)}
              disabled={historyLoading || !sessionKey}
            >
              刷新
            </Button>
          </div>
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = Math.min(historyLimit + 50, 200);
                setHistoryLimit(next);
                if (sessionKey) {
                  void loadHistory(sessionKey, next);
                }
              }}
              disabled={historyLoading || historyLimit >= 200}
            >
              加载更多
            </Button>
            <div className="text-xs text-gray-500">当前 {historyLimit} 条</div>
          </div>
          <div className="px-3 py-2 border-b border-gray-100">
            <Input
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="搜索消息..."
              className="h-8"
            />
          </div>
          <ScrollArea className="h-48">
            <div className="p-3 space-y-3 text-sm">
              {historyLoading ? (
                <div className="text-gray-500">加载中...</div>
              ) : historyMessages.length === 0 ? (
                <div className="text-gray-500">暂无消息</div>
              ) : (
                (() => {
                  const query = historyQuery.trim();
                  const filtered = historyMessages.filter((message) => {
                    if (!query) {
                      return true;
                    }
                    const text = resolveMessageText(message);
                    return text.toLowerCase().includes(query.toLowerCase());
                  });
                  if (filtered.length === 0) {
                    return <div className="text-gray-500">未找到匹配消息</div>;
                  }
                  const queryLower = query.toLowerCase();
                  return filtered.map((message, index) => {
                    const text = resolveMessageText(message);
                    const lowerText = text.toLowerCase();
                    const parts: Array<{ text: string; matched: boolean }> = [];
                    if (query && lowerText.includes(queryLower)) {
                      let startIndex = 0;
                      while (true) {
                        const hitIndex = lowerText.indexOf(queryLower, startIndex);
                        if (hitIndex === -1) {
                          const tail = text.slice(startIndex);
                          if (tail) {
                            parts.push({ text: tail, matched: false });
                          }
                          break;
                        }
                        if (hitIndex > startIndex) {
                          parts.push({
                            text: text.slice(startIndex, hitIndex),
                            matched: false,
                          });
                        }
                        parts.push({
                          text: text.slice(hitIndex, hitIndex + query.length),
                          matched: true,
                        });
                        startIndex = hitIndex + query.length;
                      }
                    } else {
                      parts.push({ text, matched: false });
                    }
                    const role = message.role === "assistant" ? "assistant" : "user";
                    const timestamp = formatTimestamp(message.timestamp);
                    return (
                      <div key={`${role}-${index}`} className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">
                            {role === "assistant" ? "助手" : "我"}
                          </span>
                          {timestamp && <span>{timestamp}</span>}
                        </div>
                        <div className="text-gray-900 whitespace-pre-wrap">
                          {parts.length > 0
                            ? parts.map((part, partIndex) =>
                                part.matched ? (
                                  <mark
                                    key={`${role}-${index}-${partIndex}`}
                                    className="rounded bg-yellow-200 px-0.5"
                                  >
                                    {part.text}
                                  </mark>
                                ) : (
                                  <span key={`${role}-${index}-${partIndex}`}>{part.text}</span>
                                ),
                              )
                            : "（无文本）"}
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </ScrollArea>
        </Card>
      )}
      <div className="flex flex-row gap-1">
        {recording ? (
          <div className="flex flex-row gap-1">
            <Button
              size="icon"
              onClick={() => {
                void handleRecording();
              }}
            >
              <MicOff />
            </Button>
            <div className="flex items-center justify-center border-[1px] border-[var(--primary)] rounded-md px-2">
              <canvas className="w-[80px] h-[36px]" id="voice-wave"></canvas>
            </div>
          </div>
        ) : (
          <Button
            size="icon"
            onClick={() => {
              void handleRecording();
            }}
          >
            <Mic />
          </Button>
        )}

        <Button size="icon" onClick={handleToggleTextInput}>
          <MessageSquare />
        </Button>
        <Button size="icon" onClick={handleToggleHistory}>
          <History />
        </Button>

        {showTextInput && (
          <div className="flex flex-row gap-1">
            <Input
              ref={textInputRef}
              value={textMessage}
              onChange={(e) => setTextMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={() => void sendTextMessage(textMessage)}
              disabled={!textMessage.trim() || textLoading}
            >
              {textLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
