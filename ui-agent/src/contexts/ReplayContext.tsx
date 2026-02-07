"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Message } from "@/components/chat/MessageList";

interface ReplayContextType {
  isReplaying: boolean;
  currentStepIndex: number;
  currentCharIndex: number;
  replaySpeed: number;
  startReplay: (messages: Message[]) => void;
  stopReplay: () => void;
  setReplaySpeed: (speed: number) => void;
  shouldShowStep: (stepIndex: number) => boolean;
  getDisplayedSummary: (originalSummary: string) => string;
}

const ReplayContext = createContext<ReplayContextType | undefined>(undefined);

interface ReplayProviderProps {
  children: React.ReactNode;
  messages: Message[];
}

export function ReplayProvider({ children, messages }: ReplayProviderProps) {
  const [isReplaying, setIsReplaying] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [replaySpeed, setReplaySpeed] = useState(800); // 每个步骤的间隔时间（毫秒）

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const charIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const totalStepsRef = useRef<number>(0);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (charIntervalRef.current) {
        clearInterval(charIntervalRef.current);
      }
    };
  }, []);

  const startReplay = useCallback(
    (replayMessages: Message[]) => {
      // 清除之前的定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (charIntervalRef.current) {
        clearInterval(charIntervalRef.current);
      }

      // 只重放 Agent 消息
      const agentMessages = replayMessages.filter((msg) => msg.role === "agent");
      if (agentMessages.length === 0) {
        return;
      }

      messagesRef.current = agentMessages;

      // 计算总步骤数
      const totalSteps = agentMessages.reduce((sum, msg) => {
        return sum + (msg.agentData?.steps.length || 0);
      }, 0);
      totalStepsRef.current = totalSteps;

      setIsReplaying(true);
      setCurrentStepIndex(0);
      setCurrentCharIndex(0);

      // 开始逐步展开步骤
      let stepCount = 0;
      intervalRef.current = setInterval(() => {
        stepCount++;
        setCurrentStepIndex(stepCount);

        if (stepCount >= totalSteps) {
          // 步骤展开完毕，开始逐字符显示 summary
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }

          // 开始逐字符显示
          const lastMessage = agentMessages[agentMessages.length - 1];
          const summaryText = lastMessage.agentData?.summary || "";

          let charCount = 0;
          charIntervalRef.current = setInterval(() => {
            charCount++;
            setCurrentCharIndex(charCount);

            if (charCount >= summaryText.length) {
              if (charIntervalRef.current) {
                clearInterval(charIntervalRef.current);
                charIntervalRef.current = null;
              }
              setIsReplaying(false);
            }
          }, 30); // 每个字符30ms
        }
      }, replaySpeed);
    },
    [replaySpeed],
  );

  const stopReplay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (charIntervalRef.current) {
      clearInterval(charIntervalRef.current);
      charIntervalRef.current = null;
    }
    setIsReplaying(false);
    setCurrentStepIndex(0);
    setCurrentCharIndex(0);
  }, []);

  const shouldShowStep = useCallback(
    (stepIndex: number): boolean => {
      if (!isReplaying) {
        return true; // 非重放时显示所有步骤
      }
      return stepIndex < currentStepIndex;
    },
    [isReplaying, currentStepIndex],
  );

  const getDisplayedSummary = useCallback(
    (originalSummary: string): string => {
      if (!isReplaying) {
        return originalSummary;
      }

      // 只有在步骤全部展开后才开始显示 summary
      if (currentStepIndex < totalStepsRef.current) {
        return "";
      }

      return originalSummary.substring(0, currentCharIndex);
    },
    [isReplaying, currentStepIndex, currentCharIndex],
  );

  const value: ReplayContextType = {
    isReplaying,
    currentStepIndex,
    currentCharIndex,
    replaySpeed,
    startReplay,
    stopReplay,
    setReplaySpeed,
    shouldShowStep,
    getDisplayedSummary,
  };

  return <ReplayContext.Provider value={value}>{children}</ReplayContext.Provider>;
}

export function useReplay() {
  const context = useContext(ReplayContext);
  if (context === undefined) {
    throw new Error("useReplay must be used within a ReplayProvider");
  }
  return context;
}
