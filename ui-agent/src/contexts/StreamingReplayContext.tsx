"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Message } from "@/components/chat/MessageList";
import { splitTextIntoWords, sleep } from "@/utils/textUtils";

interface StreamingReplayContextType {
  isStreaming: boolean;
  currentMessageIndex: number;
  currentStepIndex: number | "summary";
  currentDetailIndex: number;
  currentWordIndex: number;
  currentToolCallIndex: number;
  currentConfirmationStatus: "hidden" | "waiting" | "answered";
  streamSpeed: number;
  startStreaming: (messages: Message[]) => void;
  stopStreaming: () => void;
  setStreamSpeed: (speed: number) => void;
  shouldShowMessage: (messageIndex: number) => boolean;
  shouldShowStep: (messageIndex: number, stepIndex: number) => boolean;
  shouldShowDetail: (messageIndex: number, stepIndex: number, detailIndex: number) => boolean;
  shouldShowToolCall: (messageIndex: number, stepIndex: number, toolCallIndex: number) => boolean;
  getConfirmationStatus: (
    messageIndex: number,
    stepIndex: number,
  ) => "hidden" | "waiting" | "answered";
  getDisplayedText: (
    messageIndex: number,
    stepIndex: number | "summary",
    fullText: string,
  ) => string;
  getDisplayedDetailText: (
    messageIndex: number,
    stepIndex: number,
    detailIndex: number,
    fullText: string,
  ) => string;
}

const StreamingReplayContext = createContext<StreamingReplayContextType | undefined>(undefined);

interface StreamingReplayProviderProps {
  children: React.ReactNode;
}

export function StreamingReplayProvider({ children }: StreamingReplayProviderProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(-1);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | "summary">(-1);
  const [currentDetailIndex, setCurrentDetailIndex] = useState(-1);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentToolCallIndex, setCurrentToolCallIndex] = useState(-1);
  const [currentConfirmationStatus, setCurrentConfirmationStatus] = useState<
    "hidden" | "waiting" | "answered"
  >("hidden");
  const [streamSpeed, setStreamSpeed] = useState(40); // 40ms per word

  const stopSignalRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSignalRef.current = true;
    };
  }, []);

  const stopStreaming = useCallback(() => {
    stopSignalRef.current = true;
    setIsStreaming(false);
    setCurrentMessageIndex(-1);
    setCurrentStepIndex(-1);
    setCurrentDetailIndex(-1);
    setCurrentWordIndex(0);
    setCurrentToolCallIndex(-1);
    setCurrentConfirmationStatus("hidden");
  }, []);

  const startStreaming = useCallback(
    async (messages: Message[]) => {
      // Reset stop signal
      stopSignalRef.current = false;

      if (messages.length === 0) {
        return;
      }

      messagesRef.current = messages;
      setIsStreaming(true);
      setCurrentMessageIndex(0);
      setCurrentStepIndex(-1);
      setCurrentDetailIndex(-1);
      setCurrentWordIndex(0);
      setCurrentToolCallIndex(-1);
      setCurrentConfirmationStatus("hidden");

      try {
        // Iterate through each message
        for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
          if (stopSignalRef.current) break;

          const message = messages[msgIndex];
          setCurrentMessageIndex(msgIndex);

          // Handle agent messages with steps
          if (message.role === "agent" && message.agentData) {
            const steps = message.agentData.steps || [];

            // Reset step index to start streaming steps
            setCurrentStepIndex(0);

            for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
              if (stopSignalRef.current) break;

              setCurrentStepIndex(stepIndex);
              setCurrentDetailIndex(-1);
              setCurrentWordIndex(0);

              const step = steps[stepIndex];
              const details = step.details || [];
              const hasConfirmation = !!(step as any).confirmation;

              // Stream step title first (instant display)
              await sleep(100);

              // Add thinking pause after title appears (simulate Agent thinking)
              await sleep(800);

              // Iterate through each detail in the step
              for (let detailIndex = 0; detailIndex < details.length; detailIndex++) {
                if (stopSignalRef.current) break;

                setCurrentDetailIndex(detailIndex);
                setCurrentWordIndex(0);

                const detail = details[detailIndex];
                const detailWords = splitTextIntoWords(detail.content);

                // Stream detail content word by word
                for (let wordIndex = 0; wordIndex < detailWords.length; wordIndex++) {
                  if (stopSignalRef.current) break;

                  setCurrentWordIndex(wordIndex);
                  await sleep(streamSpeed);
                }

                // Complete current detail
                setCurrentWordIndex(detailWords.length);
                await sleep(200); // Brief pause between details
              }

              // All details in this step complete
              setCurrentDetailIndex(details.length);

              // Stream tool calls if present (one by one)
              const toolCalls = (step as any).toolCalls || [];
              if (toolCalls.length > 0) {
                setCurrentToolCallIndex(-1);
                await sleep(300); // Brief pause before showing tool calls

                for (let toolCallIndex = 0; toolCallIndex < toolCalls.length; toolCallIndex++) {
                  if (stopSignalRef.current) break;

                  setCurrentToolCallIndex(toolCallIndex);
                  await sleep(400); // Pause between each tool call appearance
                }

                // All tool calls complete
                setCurrentToolCallIndex(toolCalls.length - 1);
                await sleep(200); // Brief pause after all tool calls
              }

              // If this step has a confirmation, show waiting status first, then transition to answered
              if (hasConfirmation) {
                setCurrentConfirmationStatus("waiting");
                await sleep(2500); // 2.5 seconds for user to read and respond

                setCurrentConfirmationStatus("answered");
                await sleep(500); // Brief pause after confirmation
              }

              await sleep(1000); // Longer pause for "thinking" effect before next step
            }

            // Reset step index after all steps complete
            setCurrentStepIndex(-1);
          }
          // Handle assistant messages (final results)
          else if (message.role === "assistant" && message.content) {
            setCurrentStepIndex("summary");
            setCurrentDetailIndex(-1);
            setCurrentWordIndex(0);

            const contentWords = splitTextIntoWords(message.content);

            // Stream assistant content word by word
            for (let wordIndex = 0; wordIndex < contentWords.length; wordIndex++) {
              if (stopSignalRef.current) break;

              setCurrentWordIndex(wordIndex);
              await sleep(streamSpeed);
            }

            // Complete assistant message
            setCurrentWordIndex(contentWords.length);
            await sleep(500);
          }
        }
      } finally {
        // Streaming complete
        if (!stopSignalRef.current) {
          setIsStreaming(false);
          setCurrentMessageIndex(-1);
          setCurrentStepIndex(-1);
          setCurrentDetailIndex(-1);
          setCurrentWordIndex(0);
          setCurrentToolCallIndex(-1);
          setCurrentConfirmationStatus("hidden");
        }
      }
    },
    [streamSpeed],
  );

  const shouldShowMessage = useCallback(
    (messageIndex: number): boolean => {
      if (!isStreaming) {
        return true; // Show all messages when not streaming
      }

      // During streaming, only show messages up to and including current message
      return messageIndex <= currentMessageIndex;
    },
    [isStreaming, currentMessageIndex],
  );

  const shouldShowStep = useCallback((messageIndex: number, stepIndex: number): boolean => {
    // ALWAYS show all steps - don't hide them during streaming
    // We'll control the content visibility through getDisplayedText instead
    return true;
  }, []);

  const shouldShowDetail = useCallback(
    (messageIndex: number, stepIndex: number, detailIndex: number): boolean => {
      if (!isStreaming) {
        return true; // Show all details when not streaming
      }

      // Show details for completed messages
      if (messageIndex < currentMessageIndex) {
        return true;
      }

      // Current message
      if (messageIndex === currentMessageIndex) {
        // Not at this step yet
        if (typeof currentStepIndex === "number" && stepIndex > currentStepIndex) {
          return false;
        }

        // At current step
        if (stepIndex === currentStepIndex) {
          // Show completed details and current detail
          return detailIndex <= currentDetailIndex;
        }

        // Previous steps show all details
        if (typeof currentStepIndex === "number" && stepIndex < currentStepIndex) {
          return true;
        }
      }

      // Future messages - hide
      return false;
    },
    [isStreaming, currentMessageIndex, currentStepIndex, currentDetailIndex],
  );

  const getDisplayedText = useCallback(
    (messageIndex: number, stepIndex: number | "summary", fullText: string): string => {
      if (!isStreaming) {
        return fullText; // Show full text when not streaming
      }

      // Show full text for completed messages
      if (messageIndex < currentMessageIndex) {
        return fullText;
      }

      // Current message
      if (messageIndex === currentMessageIndex) {
        // For steps: show full text for completed steps, empty for future steps
        if (typeof stepIndex === "number" && typeof currentStepIndex === "number") {
          if (stepIndex < currentStepIndex) {
            // Previous steps: show full text
            return fullText;
          } else if (stepIndex === currentStepIndex) {
            // Current step: show full text (steps appear instantly)
            return fullText;
          } else {
            // Future steps: show nothing
            return "";
          }
        }

        // For summary: show word-by-word
        if (stepIndex === "summary" && currentStepIndex === "summary") {
          const words = splitTextIntoWords(fullText);
          return words.slice(0, currentWordIndex + 1).join("");
        }

        // If we're still on steps (not summary yet), don't show summary
        if (stepIndex === "summary" && typeof currentStepIndex === "number") {
          return "";
        }
      }

      // Future messages - show nothing
      return "";
    },
    [isStreaming, currentMessageIndex, currentStepIndex, currentWordIndex],
  );

  const getDisplayedDetailText = useCallback(
    (messageIndex: number, stepIndex: number, detailIndex: number, fullText: string): string => {
      if (!isStreaming) {
        return fullText; // Show full text when not streaming
      }

      // Show full text for completed messages
      if (messageIndex < currentMessageIndex) {
        return fullText;
      }

      // Current message
      if (messageIndex === currentMessageIndex) {
        // Not at this step yet
        if (typeof currentStepIndex === "number" && stepIndex > currentStepIndex) {
          return "";
        }

        // At current step
        if (stepIndex === currentStepIndex) {
          // Completed details show full text
          if (detailIndex < currentDetailIndex) {
            return fullText;
          }

          // Current detail being streamed - show word by word
          if (detailIndex === currentDetailIndex) {
            const words = splitTextIntoWords(fullText);
            return words.slice(0, currentWordIndex + 1).join("");
          }

          // Future details - empty
          return "";
        }

        // Previous steps show all details fully
        if (typeof currentStepIndex === "number" && stepIndex < currentStepIndex) {
          return fullText;
        }
      }

      // Future messages - show nothing
      return "";
    },
    [isStreaming, currentMessageIndex, currentStepIndex, currentDetailIndex, currentWordIndex],
  );

  const shouldShowToolCall = useCallback(
    (messageIndex: number, stepIndex: number, toolCallIndex: number): boolean => {
      if (!isStreaming) {
        return true; // Show all tool calls when not streaming
      }

      // Show all tool calls for completed messages
      if (messageIndex < currentMessageIndex) {
        return true;
      }

      // Current message
      if (messageIndex === currentMessageIndex) {
        // Not at this step yet
        if (typeof currentStepIndex === "number" && stepIndex > currentStepIndex) {
          return false;
        }

        // At current step
        if (stepIndex === currentStepIndex) {
          // Show completed tool calls and current tool call
          return toolCallIndex <= currentToolCallIndex;
        }

        // Previous steps show all tool calls
        if (typeof currentStepIndex === "number" && stepIndex < currentStepIndex) {
          return true;
        }
      }

      // Future messages - hide
      return false;
    },
    [isStreaming, currentMessageIndex, currentStepIndex, currentToolCallIndex],
  );

  const getConfirmationStatus = useCallback(
    (messageIndex: number, stepIndex: number): "hidden" | "waiting" | "answered" => {
      if (!isStreaming) {
        return "answered"; // Always show as answered when not streaming
      }

      // Show as answered for completed messages
      if (messageIndex < currentMessageIndex) {
        return "answered";
      }

      // Current message
      if (messageIndex === currentMessageIndex) {
        // Not at this step yet
        if (typeof currentStepIndex === "number" && stepIndex > currentStepIndex) {
          return "hidden";
        }

        // At current step
        if (stepIndex === currentStepIndex) {
          return currentConfirmationStatus;
        }

        // Previous steps show as answered
        if (typeof currentStepIndex === "number" && stepIndex < currentStepIndex) {
          return "answered";
        }
      }

      // Future messages - hide
      return "hidden";
    },
    [isStreaming, currentMessageIndex, currentStepIndex, currentConfirmationStatus],
  );

  const value: StreamingReplayContextType = {
    isStreaming,
    currentMessageIndex,
    currentStepIndex,
    currentDetailIndex,
    currentWordIndex,
    currentToolCallIndex,
    currentConfirmationStatus,
    streamSpeed,
    startStreaming,
    stopStreaming,
    setStreamSpeed,
    shouldShowMessage,
    shouldShowStep,
    shouldShowDetail,
    shouldShowToolCall,
    getConfirmationStatus,
    getDisplayedText,
    getDisplayedDetailText,
  };

  return (
    <StreamingReplayContext.Provider value={value}>{children}</StreamingReplayContext.Provider>
  );
}

export function useStreamingReplay() {
  const context = useContext(StreamingReplayContext);
  if (context === undefined) {
    throw new Error("useStreamingReplay must be used within a StreamingReplayProvider");
  }
  return context;
}
