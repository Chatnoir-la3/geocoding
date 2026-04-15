import { anthropic } from "@ai-sdk/anthropic";
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import { geospatialTools } from "@/lib/geospatial/tool-definition";

export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたは日本の地理空間情報に精通した不動産データアナリストです。
不動産情報ライブラリのデータを活用して、ユーザーの質問に回答します。

## 手順
1. ユーザーが住所・地名・建物名で場所を指定した場合、まず geocode ツールで緯度経度を取得してください。
2. 次に get_geospatial_data ツールで、質問に関連するAPIからデータを取得してください。
3. 取得したデータを分かりやすく構造化して回答してください。

## API選択ガイド
- 地価・価格関連 → API 1（地価公示）, 2（地価調査）, 3（取引価格）, 4（鑑定評価※現在未対応）, 5（成約価格）
- 都市計画 → API 6（用途地域）, 7（防火地域）, 8（都市計画区域）, 9（地区計画）, 10（高度利用地区）, 11（都市計画道路）, 12（立地適正化）
- 周辺施設 → API 13（学区）, 14（幼稚園保育園）, 15（医療機関）, 16（図書館）, 17（駅乗降客数）
- 災害リスク → API 18（洪水）, 19（土砂災害）, 20（津波）, 21（高潮）, 22（地すべり）, 23（急傾斜地）, 24（災害危険区域）, 25（液状化）, 26（避難場所）, 27（災害履歴）
- 地形 → API 30（大規模盛土）

## 収益シミュレーション
- 投資・利回り・収益について → simulate_investment ツール
- 「この土地をどうすべきか」「土地活用」 → diagnose_land_use ツール（売却/アパート/駐車場を比較）
- 敷地面積が不明な場合は100㎡をデフォルトとして使用し、その旨を伝えてください
- レポートURLを案内: /api/report?lat=...&lon=...&siteArea=...

## 回答のルール
- 日本語で回答すること
- データは見やすく箇条書きやテーブル形式で提示すること
- 地図URLを必ず案内すること
- モックモードの場合はその旨を伝えること
- 単位（円/㎡、m、人/日など）を明記すること`;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // UIMessage (parts形式) → ModelMessage (content形式) に変換
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: geospatialTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
