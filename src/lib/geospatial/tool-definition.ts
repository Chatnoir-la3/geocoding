import { tool } from "ai";
import { z } from "zod";
import { geocode, reverseGeocode } from "./geocoder";
import { fetchMultipleApis } from "./api-client";
import { buildMapUrl } from "./map-url";
import { getAllApiConfigs } from "./api-registry";
import { isMockModeEnabled } from "@/lib/mock/mock-responses";

const apiListDescription = getAllApiConfigs()
  .map((api) => `${api.id}: ${api.name} - ${api.description}`)
  .join("\n");

export const geospatialTools = {
  geocode: tool({
    description:
      "住所や地名、建物名から緯度経度を検索します。ユーザーが場所を指定した場合、まずこのツールで座標を取得してください。",
    inputSchema: z.object({
      query: z.string().describe("検索する住所・地名・建物名"),
    }),
    execute: async ({ query }: { query: string }) => {
      const result = await geocode(query);
      if (!result) {
        return { error: `「${query}」の座標が見つかりませんでした` };
      }
      return result;
    },
  }),

  get_geospatial_data: tool({
    description: `不動産情報ライブラリから地理空間データを取得します。
取得可能なAPIの一覧:
${apiListDescription}

複数のAPIを同時に指定できます。ユーザーの質問に関連するAPIを選択してください。
例: 地価関連 → [1,2], 災害リスク → [18,19,20,21], 周辺施設 → [13,14,15,16,17]`,
    inputSchema: z.object({
      lat: z.number().describe("緯度（例: 35.6812）"),
      lon: z.number().describe("経度（例: 139.7671）"),
      target_apis: z
        .array(z.number().min(1).max(33))
        .describe("取得するAPI番号のリスト（1〜33、28・29は廃止）"),
      distance: z
        .number()
        .optional()
        .default(425)
        .describe("ポイントデータの検索半径（メートル）。デフォルト425m"),
    }),
    execute: async ({
      lat,
      lon,
      target_apis,
      distance,
    }: {
      lat: number;
      lon: number;
      target_apis: number[];
      distance: number;
    }) => {
      const addressInfo = await reverseGeocode(lat, lon);
      const results = await fetchMultipleApis(target_apis, lat, lon, distance);
      const mapUrl = buildMapUrl(lat, lon, target_apis);

      return {
        address: addressInfo?.address || "住所不明",
        lat,
        lon,
        results: results.map((r) => ({
          apiId: r.apiId,
          apiName: r.apiName,
          featureCount: r.featureCount,
          error: r.error,
          data: r.features.slice(0, 10).map((f) => f.properties),
        })),
        mapUrl,
        mockMode: isMockModeEnabled(),
      };
    },
  }),
};
