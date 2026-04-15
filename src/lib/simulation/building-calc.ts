import type {
  BuildingStructure,
  BuildingParams,
  BuildingResult,
} from "@/types/simulation";

// ---------------------------------------------------------------------------
// 用途地域別 容積消化率テーブル
// 斜線制限・日影規制により容積率を100%使い切れないケースを補正する
// ---------------------------------------------------------------------------

const FLOOR_AREA_CONSUMPTION_RATE: Record<string, number> = {
  "第一種低層住居専用地域": 0.90,
  "第二種低層住居専用地域": 0.90,
  "田園住居地域": 0.90,
  "第一種中高層住居専用地域": 0.75,
  "第二種中高層住居専用地域": 0.80,
  "第一種住居地域": 0.85,
  "第二種住居地域": 0.85,
  "準住居地域": 0.85,
  "近隣商業地域": 0.90,
  "商業地域": 0.95,
  "準工業地域": 0.90,
  "工業地域": 0.90,
  "工業専用地域": 0.90,
};

/** テーブルキーが zoneName に含まれるかで部分一致検索。一致なしのデフォルトは 0.85 */
function getConsumptionRate(zoneName: string): number {
  for (const [key, rate] of Object.entries(FLOOR_AREA_CONSUMPTION_RATE)) {
    if (zoneName.includes(key)) return rate;
  }
  return 0.85;
}

// ---------------------------------------------------------------------------
// 低層住居地域の絶対高さ制限
// ---------------------------------------------------------------------------

const LOW_RISE_ZONES = [
  "第一種低層住居専用地域",
  "第二種低層住居専用地域",
  "田園住居地域",
];
const LOW_RISE_HEIGHT_LIMIT = 10; // メートル
const FLOOR_HEIGHT = 3; // 1階あたりの高さ（メートル）

// ---------------------------------------------------------------------------
// 防火地域による構造制限
// ---------------------------------------------------------------------------

export type FirePreventionZone = "fire" | "quasi-fire" | null;

/**
 * 防火地域の制約に基づき建物構造を補正する。
 * - 防火地域("fire") → 木造不可。wood は "rc" に変更
 * - 準防火地域("quasi-fire") → 木造は3階以下のみ。4階以上なら "steel" に変更
 * - null → 制約なし
 */
function applyFireZoneConstraint(
  structure: BuildingStructure,
  fireZone: FirePreventionZone,
  floors: number,
): BuildingStructure {
  if (fireZone === "fire" && structure === "wood") {
    return "rc";
  }
  if (fireZone === "quasi-fire" && structure === "wood" && floors >= 4) {
    return "steel";
  }
  return structure;
}

// ---------------------------------------------------------------------------
// 建築規制を含む拡張パラメータ型
// ---------------------------------------------------------------------------

interface BuildingCalcParams extends BuildingParams {
  zoneName?: string;
  firePreventionZone?: FirePreventionZone;
}

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

// ---------------------------------------------------------------------------
// 建築規制を加味した拡張シミュレーション
// ---------------------------------------------------------------------------

/**
 * 用途地域別容積消化率・高さ制限・防火地域制約を反映して建築規模を算出する。
 *
 * 処理フロー:
 * 1. 防火地域制約で構造を補正
 * 2. 用途地域から容積消化率を取得
 * 3. 容積率 × 消化率 で延床面積を再計算
 * 4. 低層住居地域の場合、高さ制限で階数を制約
 * 5. 階数制約時は延床面積 = 建築面積 × 制約後階数 に再計算
 * 6. 建築費を再計算
 */
export function calculateBuildingWithRegulations(
  params: BuildingCalcParams,
): BuildingResult & {
  consumptionRate: number;
  heightLimited: boolean;
  structureOverridden: boolean;
} {
  const {
    siteArea,
    floorAreaRatio,
    buildingCoverageRatio,
    structure,
    zoneName,
    firePreventionZone,
  } = params;

  const buildingArea = siteArea * (buildingCoverageRatio / 100);

  // 1. 容積消化率を取得・適用
  const consumptionRate = zoneName ? getConsumptionRate(zoneName) : 0.85;
  let totalFloorArea = siteArea * (floorAreaRatio / 100) * consumptionRate;

  // 2. 仮の階数を算出
  let estimatedFloors = Math.ceil(totalFloorArea / buildingArea);

  // 3. 低層住居地域の高さ制限チェック
  let heightLimited = false;
  if (zoneName) {
    const isLowRise = LOW_RISE_ZONES.some((z) => zoneName.includes(z));
    if (isLowRise) {
      const maxFloors = Math.floor(LOW_RISE_HEIGHT_LIMIT / FLOOR_HEIGHT);
      if (estimatedFloors > maxFloors) {
        estimatedFloors = maxFloors;
        totalFloorArea = buildingArea * estimatedFloors;
        heightLimited = true;
      }
    }
  }

  // 4. 防火地域制約で構造を補正
  let effectiveStructure = structure;
  let structureOverridden = false;
  if (firePreventionZone) {
    effectiveStructure = applyFireZoneConstraint(
      structure,
      firePreventionZone,
      estimatedFloors,
    );
    structureOverridden = effectiveStructure !== structure;
  }

  // 5. 建築費を算出
  const constructionCost = totalFloorArea * COST_PER_SQM[effectiveStructure];

  return {
    buildingArea,
    totalFloorArea,
    estimatedFloors,
    constructionCost,
    structureName: STRUCTURE_NAME[effectiveStructure],
    consumptionRate,
    heightLimited,
    structureOverridden,
  };
}
