"use client";

import { useEffect, useState } from "react";

interface SubtitlesProps {
  text: string;
  isSpeaking: boolean;
  maxLines?: number;
  autoHide?: boolean;
  autoHideDelay?: number;
}

export function Subtitles({
  text,
  isSpeaking,
  maxLines = 3,
  autoHide = true,
  autoHideDelay = 5000,
}: SubtitlesProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (text) {
      setVisible(true);
    } else if (autoHide) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [text, autoHide, autoHideDelay]);

  if (!visible && !text) {
    return null;
  }

  return (
    <div
      className={`
        max-w-lg px-4 py-2 rounded-lg transition-all duration-300
        ${isSpeaking ? "bg-black/70" : "bg-black/50"}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
      `}
    >
      <p
        className="text-white text-sm text-center leading-relaxed"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {text || "..."}
      </p>
    </div>
  );
}

export default Subtitles;
