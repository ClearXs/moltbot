// TTS service for calling gateway tts.convert RPC

import type { ClawdbotWebSocketClient } from "@/services/clawdbot-websocket";

interface TtsResponse {
  audioBase64?: string;
  audioPath?: string;
}

// Global audio context for TTS playback (supports interruption)
let globalAudioContext: AudioContext | null = null;
let currentAudioSource: AudioBufferSourceNode | null = null;
let currentOnEnded: (() => void) | null = null;

// Get or create global audio context
function getAudioContext(): AudioContext {
  if (!globalAudioContext || globalAudioContext.state === "closed") {
    globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
}

export async function convertTextToSpeech(
  client: ClawdbotWebSocketClient,
  text: string,
  channel: string = "ui-agent",
): Promise<ArrayBuffer> {
  const payload = await client.sendRequest<{
    audioBase64?: string;
    audioPath?: string;
  }>("tts.convert", { text, channel });

  if (!payload.audioBase64) {
    throw new Error("TTS audio unavailable");
  }

  // Decode base64 to ArrayBuffer
  const binary = atob(payload.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Stop any currently playing audio
export function stopTtsAudio(): void {
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch {
      // Ignore if already stopped
    }
    currentAudioSource = null;
  }

  // Call the onEnded callback to reset state
  if (currentOnEnded) {
    currentOnEnded();
    currentOnEnded = null;
  }
}

export async function playTtsAudio(audioBuffer: ArrayBuffer, onEnded?: () => void): Promise<void> {
  // Stop any currently playing audio first
  stopTtsAudio();

  const audioContext = getAudioContext();

  // Resume audio context if suspended
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  try {
    const decoded = await audioContext.decodeAudioData(audioBuffer.slice(0));
    const source = audioContext.createBufferSource();
    source.buffer = decoded;
    source.connect(audioContext.destination);

    currentAudioSource = source;
    currentOnEnded = onEnded || null;

    source.start();

    return new Promise((resolve) => {
      source.onended = () => {
        currentAudioSource = null;
        currentOnEnded = null;
        resolve();
      };
    });
  } catch (error) {
    currentAudioSource = null;
    currentOnEnded = null;
    throw error;
  }
}
