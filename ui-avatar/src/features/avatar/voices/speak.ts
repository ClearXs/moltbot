import { VRMExpressionPresetName } from "@pixiv/three-vrm";
import { callGateway } from "@/services/gateway";
import { wait } from "@/utils/wait";
import { Viewer } from "../vrm/viewer";

const emotions = ["neutral", "happy", "angry", "sad", "relaxed"] as const;
export type EmotionType = (typeof emotions)[number] & VRMExpressionPresetName;

export type Screenplay = {
  text: string;
  language: string;
  expression: EmotionType;
};

const useSpeakApi = () => {
  let lastTime = 0;
  let prevFetchPromise: Promise<unknown> = Promise.resolve();
  let prevSpeakPromise: Promise<unknown> = Promise.resolve();

  const continuousFetchAudio = (
    viewer: Viewer,
    expression: EmotionType,
    fetchInterval: number,
    fetchAudio: () => Promise<ArrayBuffer>,
    onStart?: () => void,
    onComplete?: () => void,
  ) => {
    const fetchPromise = prevFetchPromise.then(async () => {
      const now = Date.now();
      if (now - lastTime < fetchInterval) {
        await wait(fetchInterval - (now - lastTime));
      }

      const buffer = await fetchAudio().catch(() => null);
      lastTime = Date.now();
      return buffer;
    });

    prevFetchPromise = fetchPromise;
    prevSpeakPromise = Promise.all([fetchPromise, prevSpeakPromise]).then(([audioBuffer]) => {
      onStart?.();
      if (!audioBuffer) {
        return;
      }
      return viewer.model?.speak(audioBuffer, expression);
    });
    void prevSpeakPromise.then(() => {
      onComplete?.();
    });
  };

  const getTtsAudio = (text: string) => async (): Promise<ArrayBuffer> => {
    const payload = await callGateway<{
      audioBase64?: string;
      audioPath?: string;
    }>("tts.convert", { text, channel: "ui-avatar" });
    if (!payload.audioBase64) {
      throw new Error("TTS audio unavailable");
    }
    const binary = atob(payload.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const speak = (
    expression: EmotionType,
    viewer: Viewer,
    text?: string,
    onStart?: () => void,
    onComplete?: () => void,
    getAudio?: () => Promise<ArrayBuffer>,
  ) => {
    continuousFetchAudio(
      viewer,
      expression,
      0,
      getAudio ?? getTtsAudio(text!),
      onStart,
      onComplete,
    );
  };

  return {
    speak,
  };
};

export default useSpeakApi;
