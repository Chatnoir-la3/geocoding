"use client";

import { useRef, useEffect } from "react";
import type { UIMessage } from "ai";
import { MessageBubble } from "./message-bubble";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  messages: UIMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-3 max-w-md px-4">
          <p className="text-lg font-medium">
            地理空間情報について質問してください
          </p>
          <div className="text-sm space-y-1">
            <p>例:</p>
            <p className="text-primary">&quot;東京駅周辺の地価を教えて&quot;</p>
            <p className="text-primary">&quot;渋谷の災害リスクを調べて&quot;</p>
            <p className="text-primary">&quot;横浜駅近くの用途地域は？&quot;</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>考え中...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
