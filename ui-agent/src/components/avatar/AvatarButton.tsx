"use client";

import { Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAvatarStore } from "@/stores/avatarStore";

interface AvatarButtonProps {
  className?: string;
}

export function AvatarButton({ className }: AvatarButtonProps) {
  const { openModal, currentPersona, isSpeaking, isRecording } = useAvatarStore();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`relative ${className}`}
      onClick={openModal}
      title="打开 AI 助手"
    >
      {currentPersona?.name ? (
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="text-xs font-medium text-primary">{currentPersona.name[0]}</span>
        </div>
      ) : (
        <Bot className="w-6 h-6" />
      )}

      {/* Status indicator */}
      {(isSpeaking || isRecording) && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
              isRecording ? "bg-red-400" : "bg-green-400"
            } opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-3 w-3 ${
              isRecording ? "bg-red-500" : "bg-green-500"
            }`}
          />
        </span>
      )}
    </Button>
  );
}

export default AvatarButton;
