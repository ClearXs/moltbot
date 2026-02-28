// ASR Hook using Web Speech API

import { useState, useCallback, useRef, useEffect } from "react";
import { WebSpeechRecognizer } from "../voices/asr";

export interface UseAsrOptions {
  language?: string;
  onResult?: (text: string) => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface UseAsrReturn {
  isListening: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
}

export function useAsr(options: UseAsrOptions = {}): UseAsrReturn {
  const { language = "zh-CN", onResult, onEnd, onError } = options;
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognizerRef = useRef<WebSpeechRecognizer | null>(null);

  useEffect(() => {
    recognizerRef.current = new WebSpeechRecognizer();
    setIsSupported(recognizerRef.current.isSupported());
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    if (!recognizerRef.current) {
      setError("Speech recognition not initialized");
      return;
    }

    if (!recognizerRef.current.isSupported()) {
      setError("Browser does not support speech recognition");
      return;
    }

    setError(null);
    setTranscript("");

    recognizerRef.current.setLanguage(language);
    recognizerRef.current.start(
      (text) => {
        setTranscript(text);
        onResult?.(text);
      },
      () => {
        setIsListening(false);
        onEnd?.();
      },
      (err) => {
        setError(err);
        setIsListening(false);
        onError?.(err);
      },
    );

    setIsListening(true);
  }, [language, onResult, onEnd, onError]);

  const stop = useCallback(() => {
    recognizerRef.current?.stop();
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    error,
    isSupported,
    start,
    stop,
  };
}
