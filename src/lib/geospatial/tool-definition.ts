import { tool } from "ai";
import { z } from "zod";
import { geocode, reverseGeocode } from "./geocoder";
import { fetchMultipleApis, fetchGeospatialData } from "./api-client";
import { buildMapUrl } from "./map-url";
import { getAllApiConfigs } from "./api-registry";
import { isMockModeEnabled } from "@/lib/mock/mock-responses";
import {
  calculateBuildingWithRegulations,
  suggestStructure,
  parseZoningData,
} from "@/lib/simulation/building-calc";
import type { FirePreventionZone } from "@/lib/simulation/building-calc";
import { estimateRent } from "@/lib/simulation/rent-estimator";
import { calculateRevenue } from "@/lib/simulation/revenue-calculator";
import { getAreaBenchmark } from "@/lib/simulation/area-benchmarks";
import { diagnoseLandUse } from "@/lib/simulation/land-use-diagnosis";
import type { BuildingStructure } from "@/types/simulation";
import type { GeoJsonFeature } from "@/types/geospatial";

/**
 * API 7（防火・準防火地域）のレスポンスから防火区分を判定する。
 */
function parseFireZone(features: GeoJsonFeature[]): FirePreventionZone {
  if (features.length === 0) return null;
  const props = features[0].properties;
  const values = Object.values(props).map(String).join(" ");
  if (values.includes("防火地域") && !values.includes("準防火")) return "fire";
  if (values.includes("準防火")) return "quasi-fire";
  return null;
}

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

  simulate_investment: tool({
    description: `指定した土地の収益シミュレーションを実行します。
用途地域・地価データを自動取得し、建築可能規模・想定賃料・利回り・キャッシュフローを算出します。
投資判断や土地活用提案に使用してください。`,
    inputSchema: z.object({
      lat: z.number().describe("緯度"),
      lon: z.number().describe("経度"),
      siteArea: z.number().describe("敷地面積（㎡）"),
      structure: z
        .enum(["rc", "steel", "wood"])
        .optional()
        .describe("建物構造（省略時は用途地域から自動推奨）"),
    }),
    execute: async ({
      lat,
      lon,
      siteArea,
      structure,
    }: {
      lat: number;
      lon: number;
      siteArea: number;
      structure?: BuildingStructure;
    }) => {
      // 1. 用途地域(API 6)、地価公示(API 1)、防火地域(API 7)、地区計画(API 9)、高度利用地区(API 10)を並列取得
      const [zoningResult, landPriceResult, fireZoneResult, districtPlanResult, heightDistrictResult] = await Promise.all([
        fetchGeospatialData(6, lat, lon),
        fetchGeospatialData(1, lat, lon),
        fetchGeospatialData(7, lat, lon),
        fetchGeospatialData(9, lat, lon),
        fetchGeospatialData(10, lat, lon),
      ]);

      // 2. 用途地域データから容積率・建蔽率を抽出
      let floorAreaRatio = 200;
      let buildingCoverageRatio = 60;
      let zoneName = "不明";

      if (zoningResult.features.length > 0) {
        const zoning = parseZoningData(
          zoningResult.features[0].properties,
        );
        if (zoning) {
          floorAreaRatio = zoning.floorAreaRatio;
          buildingCoverageRatio = zoning.buildingCoverageRatio;
          zoneName = zoning.zoneName;
        }
      }

      // 3. 防火地域の判定
      const fireZone = parseFireZone(fireZoneResult.features);

      // 4. 構造が未指定なら用途地域から推奨
      const resolvedStructure = structure ?? suggestStructure(floorAreaRatio);

      // 5. 建築規模を算出（法規制反映）
      const building = calculateBuildingWithRegulations({
        siteArea,
        floorAreaRatio,
        buildingCoverageRatio,
        structure: resolvedStructure,
        zoneName,
        firePreventionZone: fireZone,
      });

      // 6. 逆ジオコードで都道府県コードを取得
      const addressInfo = await reverseGeocode(lat, lon);
      const prefCode = addressInfo?.prefCode ?? "";
      const address = addressInfo?.address ?? "住所不明";

      // 7. 地価公示データから㎡単価を抽出
      let landPricePerSqm = 0;
      if (landPriceResult.features.length > 0) {
        for (const feature of landPriceResult.features) {
          const props = feature.properties;
          const currentYearPrice = Number(
            props["u_current_years_price_ja"],
          );
          if (Number.isFinite(currentYearPrice) && currentYearPrice > 0) {
            landPricePerSqm = currentYearPrice;
            break;
          }
          const lastYearPrice = Number(props["last_years_price"]);
          if (Number.isFinite(lastYearPrice) && lastYearPrice > 0) {
            landPricePerSqm = lastYearPrice;
            break;
          }
        }
      }

      // 地価が取得できなかった場合はエリアベンチマークで代用
      if (landPricePerSqm === 0) {
        const benchmark = getAreaBenchmark(prefCode);
        // ベンチマーク賃料から還元利回りで逆算: 地価 = 賃料(年) / capRate
        landPricePerSqm = (benchmark.rentPerSqm * 12) / benchmark.capRate;
      }

      const landPrice = landPricePerSqm * siteArea;

      // 8. 賃料推定
      const rentResult = estimateRent({
        lat,
        lon,
        totalFloorArea: building.totalFloorArea,
        structure: resolvedStructure,
        prefCode,
        landPricePerSqm,
      });

      // 9. 収益計算
      const revenue = calculateRevenue({
        annualRent: rentResult.annualRent,
        constructionCost: building.constructionCost,
        landPrice,
        totalFloorArea: building.totalFloorArea,
      });

      const totalInvestment = building.constructionCost + landPrice;

      // 10. 結果を構造化して返す
      return {
        address,
        zoning: {
          name: zoneName,
          floorAreaRatio,
          buildingCoverageRatio,
        },
        building: {
          structure: building.structureName,
          totalFloorArea: building.totalFloorArea,
          floors: building.estimatedFloors,
          constructionCost: building.constructionCost,
        },
        rent: {
          monthlyRent: rentResult.monthlyRent,
          annualRent: rentResult.annualRent,
          method: rentResult.method,
          confidence: rentResult.confidence,
        },
        revenue: {
          grossYield: revenue.grossYield,
          netYield: revenue.netYield,
          noi: revenue.noi,
          cashFlow: revenue.cashFlow,
          dcr: revenue.dcr,
          irr5y: revenue.irr5y,
          irr10y: revenue.irr10y,
        },
        regulations: {
          firePreventionZone: fireZone,
          districtPlan: districtPlanResult.featureCount > 0,
          heightDistrict: heightDistrictResult.featureCount > 0,
          consumptionRate: building.consumptionRate,
          heightLimited: building.heightLimited,
          structureOverridden: building.structureOverridden,
        },
        landPrice,
        totalInvestment,
        disclaimer:
          "本シミュレーションは国土交通省データに基づく概算であり、実際の収益を保証するものではありません。投資判断は専門家にご相談ください。",
      };
    },
  }),

  diagnose_land_use: tool({
    description: `土地活用の最適方法を診断します。売却・アパート建築・月極駐車場・コインパーキングの4パターンを利回り・10年リターンで比較し、最適な活用方法を提案します。
遊休地の活用相談や「この土地をどうすべきか」という質問に使用してください。`,
    inputSchema: z.object({
      lat: z.number().describe("緯度"),
      lon: z.number().describe("経度"),
      siteArea: z.number().describe("敷地面積（㎡）"),
    }),
    execute: async ({
      lat,
      lon,
      siteArea,
    }: {
      lat: number;
      lon: number;
      siteArea: number;
    }) => {
      // 用途地域(API 6)、地価公示(API 1)、防火地域(API 7)を並列取得
      const [zoningResult, landPriceResult, fireZoneResult] = await Promise.all([
        fetchGeospatialData(6, lat, lon),
        fetchGeospatialData(1, lat, lon),
        fetchGeospatialData(7, lat, lon),
      ]);

      let floorAreaRatio = 200;
      let buildingCoverageRatio = 60;

      if (zoningResult.features.length > 0) {
        const zoning = parseZoningData(zoningResult.features[0].properties);
        if (zoning) {
          floorAreaRatio = zoning.floorAreaRatio;
          buildingCoverageRatio = zoning.buildingCoverageRatio;
        }
      }

      // 防火地域の判定
      const fireZone = parseFireZone(fireZoneResult.features);

      // 逆ジオコードで都道府県コード取得
      const addressInfo = await reverseGeocode(lat, lon);
      const prefCode = addressInfo?.prefCode ?? "";

      // 地価㎡単価を抽出
      let landPricePerSqm = 0;
      if (landPriceResult.features.length > 0) {
        for (const feature of landPriceResult.features) {
          const props = feature.properties;
          const price = Number(props["u_current_years_price_ja"]) || Number(props["last_years_price"]);
          if (Number.isFinite(price) && price > 0) {
            landPricePerSqm = price;
            break;
          }
        }
      }
      if (landPricePerSqm === 0) {
        const benchmark = getAreaBenchmark(prefCode);
        landPricePerSqm = (benchmark.rentPerSqm * 12) / benchmark.capRate;
      }

      const diagnosis = diagnoseLandUse({
        siteArea,
        landPricePerSqm,
        prefCode,
        floorAreaRatio,
        buildingCoverageRatio,
      });

      return {
        address: addressInfo?.address ?? "住所不明",
        siteArea,
        landPricePerSqm,
        options: diagnosis.options.map((o) => ({
          type: o.type,
          label: o.label,
          initialCost: o.initialCost,
          annualIncome: o.annualIncome,
          noi: o.noi,
          yield: o.yield,
          totalReturn10y: o.totalReturn10y,
        })),
        regulations: {
          firePreventionZone: fireZone,
        },
        recommendation: diagnosis.recommendation,
        reportUrl: `/api/report?lat=${lat}&lon=${lon}&siteArea=${siteArea}`,
        disclaimer:
          "本診断は概算であり、実際の収益を保証するものではありません。",
      };
    },
  }),
};
