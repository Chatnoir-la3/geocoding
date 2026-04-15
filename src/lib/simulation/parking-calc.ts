/**
 * 駐車場収益計算モジュール
 *
 * 月極・コインパーキングの収益シミュレーションを行う。
 */

/** 1台あたり必要面積（㎡、通路含む） */
const AREA_PER_SPACE = 15;

/** 月極: 都道府県別月額賃料（円/台） */
const MONTHLY_RENT_BY_PREF: Record<string, number> = {
  "13": 30_000, // 東京
  "14": 18_000, // 神奈川
  "27": 20_000, // 大阪
  "23": 12_000, // 愛知
  "40": 12_000, // 福岡
};
const MONTHLY_RENT_DEFAULT = 8_000;

/** コインパーキング: 都道府県別1台あたり日売上（円） */
const COIN_DAILY_REVENUE_BY_PREF: Record<string, number> = {
  "13": 4_000, // 東京
  "14": 2_500, // 神奈川
  "27": 3_000, // 大阪
  "23": 2_000, // 愛知
  "40": 2_000, // 福岡
};
const COIN_DAILY_REVENUE_DEFAULT = 1_500;

export interface ParkingParams {
  siteArea: number; // 敷地面積（㎡）
  prefCode: string; // 都道府県コード
  parkingType: "monthly" | "coin"; // 月極 or コインパーキング
}

export interface ParkingResult {
  capacity: number; // 駐車台数
  initialCost: number; // 初期投資（円）
  monthlyRevenue: number; // 月間売上（円）
  annualRevenue: number; // 年間売上（円）
  annualExpenses: number; // 年間経費（円）
  noi: number; // 純収益（円）
  yield: number; // 利回り
}

/**
 * 駐車場の収益シミュレーションを実行する。
 */
export function calculateParking(params: ParkingParams): ParkingResult {
  const { siteArea, prefCode, parkingType } = params;

  const capacity = Math.floor(siteArea / AREA_PER_SPACE);

  if (parkingType === "monthly") {
    return calculateMonthly(capacity, prefCode);
  }
  return calculateCoin(capacity, prefCode);
}

function calculateMonthly(capacity: number, prefCode: string): ParkingResult {
  // 初期投資: 舗装費50万円 + 台数 × 3万円
  const initialCost = 500_000 + capacity * 30_000;

  // 月額賃料
  const rentPerSpace =
    MONTHLY_RENT_BY_PREF[prefCode] ?? MONTHLY_RENT_DEFAULT;
  const occupancyRate = 0.9;

  const monthlyRevenue = capacity * rentPerSpace * occupancyRate;
  const annualRevenue = monthlyRevenue * 12;

  // 経費: 固定資産税概算（売上の10%）+ 管理費（売上の5%）
  const annualExpenses = annualRevenue * 0.15;

  const noi = annualRevenue - annualExpenses;
  const yieldRate = initialCost > 0 ? noi / initialCost : 0;

  return {
    capacity,
    initialCost,
    monthlyRevenue,
    annualRevenue,
    annualExpenses,
    noi,
    yield: yieldRate,
  };
}

function calculateCoin(capacity: number, prefCode: string): ParkingResult {
  // 初期投資: 台数 × 50万円
  const initialCost = capacity * 500_000;

  // 1台あたり日売上
  const dailyRevenuePerSpace =
    COIN_DAILY_REVENUE_BY_PREF[prefCode] ?? COIN_DAILY_REVENUE_DEFAULT;
  const occupancyRate = 0.7;

  const monthlyRevenue =
    capacity * dailyRevenuePerSpace * 30 * occupancyRate;
  const annualRevenue = monthlyRevenue * 12;

  // 経費: 売上の25%
  const annualExpenses = annualRevenue * 0.25;

  const noi = annualRevenue - annualExpenses;
  const yieldRate = initialCost > 0 ? noi / initialCost : 0;

  return {
    capacity,
    initialCost,
    monthlyRevenue,
    annualRevenue,
    annualExpenses,
    noi,
    yield: yieldRate,
  };
}
