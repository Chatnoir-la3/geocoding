import type {
  BuildingStructure,
  BuildingParams,
  BuildingResult,
} from "@/types/simulation";

/** 構造別㎡単価（円）— 坪単価 ÷ 3.306 で換算 */
const COST_PER_SQM: Record<BuildingStructure, number> = {
  rc: 272_000, // RC造: 坪90万円
  steel: 227_000, // S造:  坪75万円
  wood: 166_000, // 木造: 坪55万円
};

/** 構造の日本語名 */
const STRUCTURE_NAME: Record<BuildingStructure, string> = {
  rc: "鉄筋コンクリート造",
  steel: "鉄骨造",
  wood: "木造",
};

/**
 * 建築可能規模を算出する。
 *
 * - 建築面積 = 敷地面積 × 建蔽率(%) / 100
 * - 延床面積 = 敷地面積 × 容積率(%) / 100
 * - 想定階数 = ceil(延床面積 / 建築面積)
 * - 概算建築費 = 延床面積 × 構造別㎡単価
 */
export function calculateBuilding(params: BuildingParams): BuildingResult {
  const { siteArea, floorAreaRatio, buildingCoverageRatio, structure } = params;

  const buildingArea = siteArea * (buildingCoverageRatio / 100);
  const totalFloorArea = siteArea * (floorAreaRatio / 100);
  const estimatedFloors = Math.ceil(totalFloorArea / buildingArea);
  const constructionCost = totalFloorArea * COST_PER_SQM[structure];

  return {
    buildingArea,
    totalFloorArea,
    estimatedFloors,
    constructionCost,
    structureName: STRUCTURE_NAME[structure],
  };
}

/**
 * 容積率から適切な建物構造を推奨する。
 *
 * - 400%以上 → RC造（高層向き）
 * - 200%以上 → S造（中層向き）
 * - 200%未満 → 木造（低層向き）
 */
export function suggestStructure(floorAreaRatio: number): BuildingStructure {
  if (floorAreaRatio >= 400) return "rc";
  if (floorAreaRatio >= 200) return "steel";
  return "wood";
}

/**
 * XKT002（用途地域）APIレスポンスの properties から
 * 容積率・建蔽率・用途地域名を抽出する。
 *
 * 数値文字列 ("600%", "80%" 等) から先頭の数値部分を取り出す。
 * 必須フィールドが欠落または数値変換に失敗した場合は null を返す。
 */
export function parseZoningData(
  properties: Record<string, unknown>,
): {
  floorAreaRatio: number;
  buildingCoverageRatio: number;
  zoneName: string;
} | null {
  const rawFar = properties["u_floor_area_ratio_ja"];
  const rawBcr = properties["u_building_coverage_ratio_ja"];
  const rawZone = properties["use_area_ja"];

  if (rawFar == null || rawBcr == null || rawZone == null) return null;

  const far = parseNumericPercent(String(rawFar));
  const bcr = parseNumericPercent(String(rawBcr));

  if (far === null || bcr === null) return null;

  return {
    floorAreaRatio: far,
    buildingCoverageRatio: bcr,
    zoneName: String(rawZone),
  };
}

/** "600%" や "80" のような文字列から数値を抽出する。失敗時は null。 */
function parseNumericPercent(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}
