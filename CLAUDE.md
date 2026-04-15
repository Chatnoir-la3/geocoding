# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

国土交通省「不動産情報ライブラリ���APIを活用した地理空間情報チャットUIデモ。
自然言語で28種類の不動産・地理空間データを取得・表示する。

## Tech Stack

- Next.js 15 (App Router) + TypeScript + pnpm
- Vercel AI SDK v6 (`ai`, `@ai-sdk/react`, `@ai-sdk/anthropic`)
- Tailwind CSS v4 + shadcn/ui
- @turf/turf (地理空間計算)

## Commands

```bash
pnpm dev          # 開発サーバー起動 (turbopack)
pnpm build        # プロダクションビルド
npx tsc --noEmit  # 型チェック
npx eslint src/   # lint
```

## Architecture

```
[Browser]  useChat() → POST /api/chat/route.ts
                         ├─ streamText(anthropic, tools)
                         │   ├─ tool: geocode         → 国土地理院API
                         │   └─ tool: get_geospatial_data → 不動産情報ライブラリAPI（タイルAPI 28種 + 検索API 3種）
                         └─ toUIMessageStreamResponse()
```

- `src/lib/geospatial/` — 地理空間ライブラリ層（Python MCPサーバーからの移植）
  - `api-registry.ts` — 28個のAPIの設定マッピング（エンドポイント、データタイプ）
  - `api-client.ts` — 不動産情報ライブラリへのHTTPリクエスト + モック切替
  - `tool-definition.ts` — Vercel AI SDK `tool()` 定義
  - `tile-math.ts` — 緯度経度→タイル座標変換
  - `point-filter.ts` / `polygon-filter.ts` — 距離/ポリゴンフィルタ
- `src/components/chat/` — チャットUI (useChat v6 API: `sendMessage`, `status`)
- `src/components/data-display/` — 地理空間データの構造化表示
- `src/lib/mock/` — APIキー未設定時のモックデータ

## Environment Variables

```
ANTHROPIC_API_KEY=   # 必須: Claude API キー
REINFOLIB_API_KEY=   # 任意: 未設定時はモックモードで動作
```

## AI SDK v6 注意点

- `useChat` — `input`/`handleSubmit` 廃止。`sendMessage({text})` + `status` を使用
- `tool()` — `parameters` → `inputSchema` に変更
- `streamText` — `maxSteps` → `stopWhen: stepCountIs(N)` に変更
- message parts — `toolInvocation` 廃止。`part.type.startsWith("tool-")` で判定、`part.output` でアクセス

## Reference

- `地理空間MCP Server.pdf` — プロジェクト仕様概要（国土交通省 α版 2026.3）
- 不動産情報ライブラリAPI: https://www.reinfolib.mlit.go.jp/
- 元のPython MCPサーバー: github.com/chirikuuka/mlit-geospatial-mcp
- APIキー申請: https://www.reinfolib.mlit.go.jp/api/request/ (5営業日)
