import type { GeoJsonFeature } from "@/types/geospatial";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RiskFactor {
  category: string;
  score: number; // 減算スコア（0.0〜0.4）
  description: string;
}

export interface RiskScore {
  overall: number; // 総合スコア（0.0〜1.0、1.0がリスクなし）
  grade: "A" | "B" | "C" | "D";
  factors: RiskFactor[];
  discountRate: number; // 売却価格ディスカウント率（0.0〜0.5）
  financingNote: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 洪水浸水の浸水深を示す可能性のあるプロパティキーのパターン */
const FLOOD_DEPTH_KEY_PATTERN = /^A31a_/;

/** 土砂災害の特別警戒区域を示すプロパティパターン */
const SEDIMENT_SPECIAL_PATTERN = /特別警戒/;

/** 津波浸水深プロパティキーのパターン */
const TSUNAMI_DEPTH_KEY_PATTERN = /^A40_/;

/** 高潮浸水深プロパティキーのパターン */
const STORM_SURGE_DEPTH_KEY_PATTERN = /^A41_/;

/** 液状化リスクレベルプロパティキーのパターン */
const LIQUEFACTION_KEY_PATTERN = /^A50_/;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * feature の properties から指定パターンに一致するキーの数値を取得する。
 * 複数一致した場合は最大値を返す。一致なし or 数値変換不可の場合は undefined。
 */
function extractNumericProperty(
  feature: GeoJsonFeature,
  pattern: RegExp,
): number | undefined {
  const props = feature.properties;
  if (!props) return undefined;

  let max: number | undefined;
  for (const key of Object.keys(props)) {
    if (pattern.test(key)) {
      const val = Number(props[key]);
      if (!Number.isNaN(val)) {
        max = max === undefined ? val : Math.max(max, val);
      }
    }
  }
  return max;
}

/**
 * feature 群から最大の浸水深（メートル）を取得する。
 */
function getMaxDepth(
  features: GeoJsonFeature[],
  pattern: RegExp,
): number | undefined {
  let max: number | undefined;
  for (const f of features) {
    const depth = extractNumericProperty(f, pattern);
    if (depth !== undefined) {
      max = max === undefined ? depth : Math.max(max, depth);
    }
  }
  return max;
}

/**
 * 浸水深から減算スコアを算出する汎用ヘルパー。
 * thresholds は [depth, score] の昇順配列。depth 未満なら前段の score を返す。
 */
function depthToScore(
  depth: number | undefined,
  thresholds: readonly [number, number][],
  fallback: number,
): number {
  if (depth === undefined) return fallback;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (depth >= thresholds[i][0]) return thresholds[i][1];
  }
  return thresholds[0][1]; // depth が最小閾値未満でも最小スコアを返す
}

// ---------------------------------------------------------------------------
// Individual risk evaluators
// ---------------------------------------------------------------------------

function evaluateFlood(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;

  const maxDepth = getMaxDepth(features, FLOOD_DEPTH_KEY_PATTERN);
  const score = depthToScore(
    maxDepth,
    [
      [0, 0.1],
      [0.5, 0.2],
      [3.0, 0.3],
    ],
    0.15, // 数値取得不可時
  );

  const depthDesc =
    maxDepth !== undefined ? `最大浸水深 ${maxDepth}m` : "浸水区域内";

  return {
    category: "洪水浸水",
    score,
    description: `洪水浸水想定区域に該当（${depthDesc}）`,
  };
}

function evaluateSediment(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;

  // 特別警戒区域かどうかを properties の値から判定
  const isSpecial = features.some((f) => {
    const props = f.properties;
    if (!props) return false;
    return Object.values(props).some(
      (v) => typeof v === "string" && SEDIMENT_SPECIAL_PATTERN.test(v),
    );
  });

  return {
    category: "土砂災害",
    score: isSpecial ? 0.4 : 0.2,
    description: isSpecial
      ? "土砂災害特別警戒区域（レッドゾーン）に該当"
      : "土砂災害警戒区域（イエローゾーン）に該当",
  };
}

function evaluateTsunami(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;

  const maxDepth = getMaxDepth(features, TSUNAMI_DEPTH_KEY_PATTERN);
  const score = depthToScore(
    maxDepth,
    [
      [0, 0.1],
      [0.5, 0.2],
      [3.0, 0.3],
    ],
    0.15,
  );

  const depthDesc =
    maxDepth !== undefined ? `最大浸水深 ${maxDepth}m` : "浸水区域内";

  return {
    category: "津波浸水",
    score,
    description: `津波浸水想定区域に該当（${depthDesc}）`,
  };
}

function evaluateStormSurge(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;

  const maxDepth = getMaxDepth(features, STORM_SURGE_DEPTH_KEY_PATTERN);
  const score = depthToScore(
    maxDepth,
    [
      [0, 0.1],
      [0.5, 0.15],
      [3.0, 0.2],
    ],
    0.12,
  );

  const depthDesc =
    maxDepth !== undefined ? `最大浸水深 ${maxDepth}m` : "浸水区域内";

  return {
    category: "高潮浸水",
    score,
    description: `高潮浸水想定区域に該当（${depthDesc}）`,
  };
}

function evaluateLandslide(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;
  return {
    category: "地すべり",
    score: 0.15,
    description: "地すべり防止区域に該当",
  };
}

function evaluateSteepSlope(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;
  return {
    category: "急傾斜地",
    score: 0.2,
    description: "急傾斜地崩壊危険区域に該当",
  };
}

function evaluateDisasterZone(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;
  return {
    category: "災害危険区域",
    score: 0.3,
    description: "災害危険区域に指定されている",
  };
}

function evaluateLiquefaction(features: GeoJsonFeature[]): RiskFactor | null {
  if (features.length === 0) return null;

  const maxLevel = getMaxDepth(features, LIQUEFACTION_KEY_PATTERN);
  // 液状化リスクレベル: 数値が大きいほど危険と仮定
  const score = depthToScore(
    maxLevel,
    [
      [0, 0.05],
      [1, 0.1],
      [2, 0.15],
    ],
    0.1, // 数値取得不可時
  );

  return {
    category: "液状化",
    score,
    description:
      maxLevel !== undefined
        ? `液状化リスクあり（レベル${maxLevel}）`
        : "液状化リスク区域に該当",
  };
}

// ---------------------------------------------------------------------------
// Evaluator registry
// ---------------------------------------------------------------------------

const EVALUATORS: ReadonlyArray<{
  apiId: number;
  evaluate: (features: GeoJsonFeature[]) => RiskFactor | null;
}> = [
  { apiId: 18, evaluate: evaluateFlood },
  { apiId: 19, evaluate: evaluateSediment },
  { apiId: 20, evaluate: evaluateTsunami },
  { apiId: 21, evaluate: evaluateStormSurge },
  { apiId: 22, evaluate: evaluateLandslide },
  { apiId: 23, evaluate: evaluateSteepSlope },
  { apiId: 24, evaluate: evaluateDisasterZone },
  { apiId: 25, evaluate: evaluateLiquefaction },
];

// ---------------------------------------------------------------------------
// Grade & financing helpers
// ---------------------------------------------------------------------------

function toGrade(overall: number): RiskScore["grade"] {
  if (overall >= 0.8) return "A";
  if (overall >= 0.6) return "B";
  if (overall >= 0.4) return "C";
  return "D";
}

function toFinancingNote(grade: RiskScore["grade"]): string {
  switch (grade) {
    case "A":
      return "融資審査上の特段のリスク指摘なし";
    case "B":
      return "一部リスク要因あり。融資条件に影響する可能性がある";
    case "C":
      return "複数のリスク要因あり。融資審査で追加説明を求められる可能性が高い";
    case "D":
      return "融資審査で問題となる可能性が高い。建築・購入の再検討を推奨";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * ハザード情報から総合リスクスコアを算出する。
 *
 * @param hazardFeatures API ID → GeoJsonFeature[] のマップ
 * @returns リスク評価結果
 */
export function calculateRiskScore(
  hazardFeatures: Record<number, GeoJsonFeature[]>,
): RiskScore {
  const factors: RiskFactor[] = [];

  for (const { apiId, evaluate } of EVALUATORS) {
    const features = hazardFeatures[apiId] ?? [];
    const factor = evaluate(features);
    if (factor) {
      factors.push(factor);
    }
  }

  const totalDeduction = factors.reduce((sum, f) => sum + f.score, 0);
  const overall = Math.max(0, 1.0 - totalDeduction);
  const grade = toGrade(overall);
  const discountRate = Math.min(0.5, 1.0 - overall);

  return {
    overall: Math.round(overall * 1000) / 1000, // 丸め誤差を抑制
    grade,
    factors,
    discountRate: Math.round(discountRate * 1000) / 1000,
    financingNote: toFinancingNote(grade),
  };
}
