"use client";

import { MessageCircle, Trash2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";

interface ChatListProps {
  searchQuery: string;
}

const ChatList = ({ searchQuery }: ChatListProps) => {
  const chats = useChatStore((state) => state.chats);
  const currentChatId = useChatStore((state) => state.currentChatId);
  const createChat = useChatStore((state) => state.createChat);
  const setCurrentChat = useChatStore((state) => state.setCurrentChat);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateChat = () => {
    createChat();
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChat(chatId);
    setSelectedChatId(chatId);
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    deleteChat(chatId);
    if (selectedChatId === chatId) {
      setSelectedChatId(null);
    }
  };

  return (
    <div className="p-4 space-y-2">
      {filteredChats.length === 0 ? (
        <div className="text-center py-8">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            {searchQuery ? "No chats found" : "No chats yet"}
          </p>
          {!searchQuery && (
            <Button onClick={handleCreateChat} className="w-full">
              Start your first chat
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filteredChats.map((chat) => (
              <Card
                key={chat.id}
                className={cn(
                  "p-3 cursor-pointer transition-colors hover:bg-accent",
                  currentChatId === chat.id && "bg-accent border-primary",
                )}
                onClick={() => handleSelectChat(chat.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate mb-1">{chat.title}</h3>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{formatDate(chat.updatedAt)}</p>
                      <span className="text-xs text-muted-foreground">
                        {chat.messages.length} messages
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDeleteChat(e, chat.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Button onClick={handleCreateChat} variant="outline" className="w-full mt-4">
            <MessageCircle className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </>
      )}
    </div>
  );
};

export default ChatList;
