"use client";

import { create } from "zustand";
import type { Persona } from "@/components/avatar/AvatarModal";

interface AvatarState {
  // Modal state
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  toggleModal: () => void;

  // Current persona
  currentPersona: Persona | null;
  setCurrentPersona: (persona: Persona | null) => void;

  // Recording state
  isRecording: boolean;
  setIsRecording: (recording: boolean) => void;

  // Speaking state
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;

  // Current text (for subtitles)
  currentText: string;
  setCurrentText: (text: string) => void;

  // Avatar loaded state
  isAvatarLoaded: boolean;
  setIsAvatarLoaded: (loaded: boolean) => void;
}

export const useAvatarStore = create<AvatarState>((set) => ({
  // Modal state
  isModalOpen: false,
  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),

  // Current persona
  currentPersona: null,
  setCurrentPersona: (persona) => set({ currentPersona: persona }),

  // Recording state
  isRecording: false,
  setIsRecording: (recording) => set({ isRecording: recording }),

  // Speaking state
  isSpeaking: false,
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),

  // Current text
  currentText: "",
  setCurrentText: (text) => set({ currentText: text }),

  // Avatar loaded state
  isAvatarLoaded: false,
  setIsAvatarLoaded: (loaded) => set({ isAvatarLoaded: loaded }),
}));
