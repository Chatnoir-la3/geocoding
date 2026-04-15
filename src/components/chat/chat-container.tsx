"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { MessageList } from "./message-list";
import { ChatInput } from "./chat-input";
import { MapPin } from "lucide-react";

export function ChatContainer() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b px-4 py-3 flex items-center gap-2 shrink-0">
        <MapPin className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">地理空間MCP デモ</h1>
        <span className="text-xs text-muted-foreground ml-2">
          不動産情報ライブラリ × Claude AI
        </span>
      </header>

      <div className="flex-1 overflow-hidden">
        <MessageList messages={messages} isLoading={isLoading} />
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-t">
          エラー: {error.message}
        </div>
      )}

      <div className="border-t p-4 shrink-0">
        <ChatInput
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
