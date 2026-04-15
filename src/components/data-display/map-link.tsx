"use client";

import { ExternalLink } from "lucide-react";

export function MapLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <ExternalLink className="h-3 w-3" />
      不動産情報ライブラリで地図を見る
    </a>
  );
}
