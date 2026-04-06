# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

国土交通省「不動産情報ライブラリ」APIをバックエンドとした **MLIT Geospatial MCP Server**（地理空間MCP Server）を構築するプロジェクト。

- MCP (Model Context Protocol) サーバーとして、LLM/AIエージェントが自然言語で地理空間情報を取得・活用できる環境を提供
- 不動産情報ライブラリAPIが提供する35種類のデータのうち30種類を取得可能とする
- 機能: データ取得、データ分析、GISデータでの一括ダウンロード

## Reference

- `地理空間MCP Server.pdf` — プロジェクト仕様概要（国土交通省 α版 2026.3）
- 不動産情報ライブラリAPI: https://www.reinfolib.mlit.go.jp/
