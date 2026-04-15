import type { GeoJsonFeature } from "@/types/geospatial";
import type {
  BuildingStructure,
  RentEstimateParams,
  RentEstimateResult,
} from "@/types/simulation";
import { getAreaBenchmark } from "./area-benchmarks";

const DISCLAIMER =
  "本賃料推定は国土交通省データに基づく概算であり、実際の賃料を保証するものではありません";

/** 構造別補正係数 */
const STRUCTURE_FACTOR: Record<BuildingStructure, number> = {
  rc: 1.0,
  steel: 0.9,
  wood: 0.75,
};

/**
 * 数値の中央値を求める。空配列の場合は null。
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * 賃料に関連しそうなプロパティキーのパターン。
 * 不動産取引価格（XPT001）のレスポンスから㎡単価を抽出するために使用。
 */
const UNIT_PRICE_KEY_PATTERNS = [
  /unit.*price/i,
  /price.*sqm/i,
  /㎡単価/,
  /単価/,
  /unitprice/i,
  /tansqmprice/i,
  /取引価格.*㎡/,
];

const TOTAL_PRICE_KEY_PATTERNS = [
  /trade.*price/i,
  /transaction.*price/i,
  /取引価格/,
  /tradeprice/i,
  /price/i,
];

const AREA_KEY_PATTERNS = [/area/i, /面積/, /sqm/i, /menseki/i];

/**
 * feature の properties から数値を持つキーを探索する。
 * パターンリストの先頭から順にマッチを試み、最初に見つかった数値を返す。
 */
function findNumericByPatterns(
  properties: Record<string, unknown>,
  patterns: RegExp[],
): number | null {
  const keys = Object.keys(properties);
  for (const pattern of patterns) {
    for (const key of keys) {
      if (pattern.test(key)) {
        const val = Number(properties[key]);
        if (Number.isFinite(val) && val > 0) return val;
      }
    }
  }
  return null;
}

/**
 * XPT001（不動産取引価格）のレスポンス features から
 * ㎡単価の中央値を算出し、構造別補正を適用した賃料を推定する（直接法）。
 *
 * - ㎡単価フィールドを直接探索
 * - 見つからなければ取引価格 / 面積で算出
 * - 3件以上で confidence "high"、1-2件で "medium"
 */
export function estimateRentFromTransactions(
  features: GeoJsonFeature[],
  structure: BuildingStructure,
): { rentPerSqm: number; sampleCount: number } | null {
  const unitPrices: number[] = [];

  for (const feature of features) {
    const props = feature.properties;

    // まず㎡単価フィールドを探す
    let unitPrice = findNumericByPatterns(props, UNIT_PRICE_KEY_PATTERNS);

    // 見つからなければ取引価格 / 面積で算出
    if (unitPrice === null) {
      const totalPrice = findNumericByPatterns(props, TOTAL_PRICE_KEY_PATTERNS);
      const area = findNumericByPatterns(props, AREA_KEY_PATTERNS);
      if (totalPrice !== null && area !== null) {
        unitPrice = totalPrice / area;
      }
    }

    if (unitPrice !== null) {
      unitPrices.push(unitPrice);
    }
  }

  if (unitPrices.length === 0) return null;

  const medianPrice = median(unitPrices);
  if (medianPrice === null) return null;

  // 構造別補正を適用
  const rentPerSqm = medianPrice * STRUCTURE_FACTOR[structure];

  return {
    rentPerSqm,
    sampleCount: unitPrices.length,
  };
}

/**
 * 地価から賃料を逆算する間接法（フォールバック）。
 *
 * 賃料(月) = 地価(㎡) × 還元利回り(エリア別) / 12 × 構造別補正
 */
export function estimateRentFromLandPrice(
  landPricePerSqm: number,
  prefCode: string,
  structure: BuildingStructure,
): RentEstimateResult {
  const benchmark = getAreaBenchmark(prefCode);
  const rentPerSqm =
    (landPricePerSqm * benchmark.capRate * STRUCTURE_FACTOR[structure]) / 12;

  return {
    rentPerSqm,
    monthlyRent: 0, // 呼び出し元で totalFloorArea を使って算出
    annualRent: 0,
    confidence: "low",
    sampleCount: 0,
    method: "indirect",
    disclaimer: DISCLAIMER,
  };
}

/**
 * メインの賃料推定関数。
 *
 * 1. transactionFeatures があれば直接法を試行
 * 2. 直接法で結果が得られなければ間接法にフォールバック
 * 3. 免責文を付加
 */
export function estimateRent(
  params: RentEstimateParams & {
    prefCode: string;
    landPricePerSqm: number;
    transactionFeatures?: GeoJsonFeature[];
  },
): RentEstimateResult {
  const { totalFloorArea, structure, prefCode, landPricePerSqm } = params;

  // 直接法を試行
  if (params.transactionFeatures && params.transactionFeatures.length > 0) {
    const directResult = estimateRentFromTransactions(
      params.transactionFeatures,
      structure,
    );
    if (directResult !== null) {
      const { rentPerSqm, sampleCount } = directResult;
      const monthlyRent = rentPerSqm * totalFloorArea;
      const annualRent = monthlyRent * 12;
      const confidence = sampleCount >= 3 ? "high" : "medium";

      return {
        rentPerSqm,
        monthlyRent,
        annualRent,
        confidence,
        sampleCount,
        method: "direct",
        disclaimer: DISCLAIMER,
      };
    }
  }

  // 間接法にフォールバック
  const indirectResult = estimateRentFromLandPrice(
    landPricePerSqm,
    prefCode,
    structure,
  );
  const monthlyRent = indirectResult.rentPerSqm * totalFloorArea;
  const annualRent = monthlyRent * 12;

  return {
    ...indirectResult,
    monthlyRent,
    annualRent,
  };
}
