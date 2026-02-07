import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId } from "@/lib/utils";
import { ChatState, Chat, Message } from "@/types";

interface ChatStore extends ChatState {
  // Actions
  createChat: (title?: string) => string;
  deleteChat: (chatId: string) => void;
  setCurrentChat: (chatId: string | null) => void;
  addMessage: (chatId: string, message: Omit<Message, "id" | "timestamp">) => void;
  updateChatTitle: (chatId: string, title: string) => void;
  clearChats: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: [],
      currentChatId: null,
      isLoading: false,

      createChat: (title = "New Chat") => {
        const chatId = generateId();
        const newChat: Chat = {
          id: chatId,
          title,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          chats: [newChat, ...state.chats],
          currentChatId: chatId,
        }));

        return chatId;
      },

      deleteChat: (chatId) => {
        set((state) => {
          const newChats = state.chats.filter((chat) => chat.id !== chatId);
          const newCurrentChatId =
            state.currentChatId === chatId
              ? newChats.length > 0
                ? newChats[0].id
                : null
              : state.currentChatId;

          return {
            chats: newChats,
            currentChatId: newCurrentChatId,
          };
        });
      },

      setCurrentChat: (chatId) => {
        set({ currentChatId: chatId });
      },

      addMessage: (chatId, message) => {
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.id === chatId) {
              const newMessage: Message = {
                ...message,
                id: generateId(),
                timestamp: new Date(),
              };
              return {
                ...chat,
                messages: [...chat.messages, newMessage],
                updatedAt: new Date(),
              };
            }
            return chat;
          }),
        }));
      },

      updateChatTitle: (chatId, title) => {
        set((state) => ({
          chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)),
        }));
      },

      clearChats: () => {
        set({
          chats: [],
          currentChatId: null,
        });
      },
    }),
    {
      name: "chat-storage",
    },
  ),
);
