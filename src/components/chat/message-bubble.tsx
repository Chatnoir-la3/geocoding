"use client";

import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { User, Bot } from "lucide-react";
import { GeospatialCard } from "@/components/data-display/geospatial-card";
import { MapLink } from "@/components/data-display/map-link";

interface MessageBubbleProps {
  message: UIMessage;
}

interface GeospatialResult {
  apiId: number;
  apiName: string;
  featureCount: number;
  error?: string;
  data?: Record<string, unknown>[];
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "flex flex-col gap-2 max-w-[85%]",
          isUser && "items-end"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text) {
            return (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm whitespace-pre-wrap",
                  isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {part.text}
              </div>
            );
          }

          // AI SDK v6: tool parts have type "tool-{toolName}"
          if (part.type.startsWith("tool-")) {
            const toolPart = part as {
              type: string;
              toolCallId: string;
              state: string;
              input?: unknown;
              output?: unknown;
            };
            const toolName = toolPart.type.replace("tool-", "");

            if (toolPart.state === "output-available") {
              const result = toolPart.output as Record<string, unknown>;

              if (toolName === "geocode" && result && !result.error) {
                return (
                  <div
                    key={i}
                    className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5"
                  >
                    📍 {String(result.address)} (
                    {Number(result.lat).toFixed(4)},{" "}
                    {Number(result.lon).toFixed(4)})
                  </div>
                );
              }

              if (toolName === "get_geospatial_data" && result) {
                const results = result.results as GeospatialResult[] | undefined;
                const mapUrl = result.mapUrl as string | undefined;
                const mockMode = result.mockMode as boolean | undefined;

                return (
                  <div key={i} className="space-y-2 w-full">
                    {mockMode && (
                      <div className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded px-3 py-1.5">
                        モックモード: サンプルデータを表示しています
                      </div>
                    )}
                    {results?.map((apiResult, j) => (
                      <GeospatialCard key={j} result={apiResult} />
                    ))}
                    {mapUrl && <MapLink url={mapUrl} />}
                  </div>
                );
              }
            }

            if (
              toolPart.state === "input-streaming" ||
              toolPart.state === "input-available"
            ) {
              return (
                <div
                  key={i}
                  className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5 animate-pulse"
                >
                  {toolName === "geocode"
                    ? "住所を検索中..."
                    : "地理空間データを取得中..."}
                </div>
              );
            }

            if (toolPart.state === "output-error") {
              return (
                <div
                  key={i}
                  className="text-xs text-destructive bg-destructive/10 rounded px-3 py-1.5"
                >
                  ツール実行エラー
                </div>
              );
            }
          }

          return null;
        })}
      </div>
    </div>
  );
}
