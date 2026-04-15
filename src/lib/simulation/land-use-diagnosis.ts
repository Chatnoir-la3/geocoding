/**
 * 土地活用診断モジュール
 *
 * 売却・アパート・月極駐車場・コインパーキングの4つの選択肢を比較し、
 * 最適な土地活用方法を推奨する。
 */

import { calculateBuilding, suggestStructure } from "./building-calc";
import { estimateRentFromLandPrice } from "./rent-estimator";
import { calculateRevenue } from "./revenue-calculator";
import { calculateParking } from "./parking-calc";

export interface LandUseDiagnosisParams {
  siteArea: number;
  landPricePerSqm: number;
  prefCode: string;
  floorAreaRatio: number;
  buildingCoverageRatio: number;
}

export interface LandUseOption {
  type: "sell" | "apartment" | "parking_monthly" | "parking_coin";
  label: string;
  initialCost: number;
  annualIncome: number;
  annualExpenses: number;
  noi: number;
  yield: number;
  totalReturn10y: number; // 10年累計リターン（売却の場合は手取り額）
}

export interface LandUseDiagnosisResult {
  options: LandUseOption[];
  recommendation: string; // AI向け推奨コメント
}

/** 出口還元利回り */
const EXIT_CAP_RATE = 0.05;

/**
 * 土地活用診断を実行する。
 * 4つの活用方法を比較し、推奨コメント付きで返す。
 */
export function diagnoseLandUse(
  params: LandUseDiagnosisParams,
): LandUseDiagnosisResult {
  const {
    siteArea,
    landPricePerSqm,
    prefCode,
    floorAreaRatio,
    buildingCoverageRatio,
  } = params;

  const options: LandUseOption[] = [
    buildSellOption(siteArea, landPricePerSqm),
    buildApartmentOption(
      siteArea,
      landPricePerSqm,
      prefCode,
      floorAreaRatio,
      buildingCoverageRatio,
    ),
    buildParkingOption(siteArea, prefCode, "monthly"),
    buildParkingOption(siteArea, prefCode, "coin"),
  ];

  const recommendation = generateRecommendation(
    options,
    floorAreaRatio,
    landPricePerSqm,
  );

  return { options, recommendation };
}

function buildSellOption(
  siteArea: number,
  landPricePerSqm: number,
): LandUseOption {
  const salePrice = landPricePerSqm * siteArea;
  const brokerageFee = salePrice * 0.03 + 60_000;
  const netProceeds = salePrice - brokerageFee;

  return {
    type: "sell",
    label: "売却",
    initialCost: 0,
    annualIncome: 0,
    annualExpenses: 0,
    noi: 0,
    yield: 0,
    totalReturn10y: netProceeds,
  };
}

function buildApartmentOption(
  siteArea: number,
  landPricePerSqm: number,
  prefCode: string,
  floorAreaRatio: number,
  buildingCoverageRatio: number,
): LandUseOption {
  const structure = suggestStructure(floorAreaRatio);

  const building = calculateBuilding({
    siteArea,
    floorAreaRatio,
    buildingCoverageRatio,
    structure,
  });

  // 間接法で賃料推定
  const rentEstimate = estimateRentFromLandPrice(
    landPricePerSqm,
    prefCode,
    structure,
  );
  const monthlyRent = rentEstimate.rentPerSqm * building.totalFloorArea;
  const annualRent = monthlyRent * 12;

  const landPrice = landPricePerSqm * siteArea;

  const revenue = calculateRevenue({
    annualRent,
    constructionCost: building.constructionCost,
    landPrice,
    totalFloorArea: building.totalFloorArea,
  });

  // totalReturn10y = CF × 10 + 出口価格（NOI ÷ 0.05）- ローン残高
  // ローン残高は calculateRevenue 内部で計算されるが外部公開されていないため再計算
  const totalInvestment = building.constructionCost + landPrice;
  const loanAmount = totalInvestment * 0.7; // デフォルト LTV
  const loanRate = 0.02; // デフォルト金利
  const loanTermYears = 35; // デフォルト融資期間
  const remaining10y = loanBalanceAt(loanAmount, loanRate, loanTermYears, 10);

  const exitPrice = revenue.noi / EXIT_CAP_RATE;
  const totalReturn10y =
    revenue.cashFlow * 10 + exitPrice - remaining10y;

  return {
    type: "apartment",
    label: "アパート建築",
    initialCost: building.constructionCost,
    annualIncome: revenue.effectiveGrossIncome,
    annualExpenses: revenue.effectiveGrossIncome - revenue.noi,
    noi: revenue.noi,
    yield: revenue.netYield,
    totalReturn10y,
  };
}

function buildParkingOption(
  siteArea: number,
  prefCode: string,
  parkingType: "monthly" | "coin",
): LandUseOption {
  const parking = calculateParking({ siteArea, prefCode, parkingType });

  const type =
    parkingType === "monthly" ? "parking_monthly" : "parking_coin";
  const label =
    parkingType === "monthly" ? "月極駐車場" : "コインパーキング";

  return {
    type: type as "parking_monthly" | "parking_coin",
    initialCost: parking.initialCost,
    label,
    annualIncome: parking.annualRevenue,
    annualExpenses: parking.annualExpenses,
    noi: parking.noi,
    yield: parking.yield,
    totalReturn10y: parking.noi * 10,
  };
}

/**
 * ローン残高を計算する（n年後）。
 * revenue-calculator.ts の内部関数と同一ロジック。
 */
function loanBalanceAt(
  principal: number,
  annualRate: number,
  totalYears: number,
  elapsedYears: number,
): number {
  if (annualRate === 0) {
    return principal * (1 - elapsedYears / totalYears);
  }
  const factor = Math.pow(1 + annualRate, totalYears);
  const factorT = Math.pow(1 + annualRate, elapsedYears);
  return (principal * (factor - factorT)) / (factor - 1);
}

/**
 * 4つの選択肢から推奨コメントを生成する。
 */
function generateRecommendation(
  options: LandUseOption[],
  floorAreaRatio: number,
  landPricePerSqm: number,
): string {
  // totalReturn10y が最大の選択肢を特定
  const best = options.reduce((a, b) =>
    a.totalReturn10y >= b.totalReturn10y ? a : b,
  );

  const parts: string[] = [
    `10年累計リターンが最も高いのは「${best.label}」（${formatYen(best.totalReturn10y)}）です。`,
  ];

  if (floorAreaRatio >= 200) {
    parts.push(
      `容積率${floorAreaRatio}%と高いため、アパート建築による高度利用が有利です。`,
    );
  } else {
    parts.push(
      `容積率${floorAreaRatio}%のため、駐車場経営も有力な選択肢です。`,
    );
  }

  if (landPricePerSqm >= 1_000_000) {
    parts.push(
      `地価が㎡${formatYen(landPricePerSqm)}と高額のため、売却も検討に値します。`,
    );
  }

  return parts.join("");
}

function formatYen(amount: number): string {
  if (Math.abs(amount) >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(1)}億円`;
  }
  if (Math.abs(amount) >= 10_000) {
    return `${Math.round(amount / 10_000).toLocaleString()}万円`;
  }
  return `${Math.round(amount).toLocaleString()}円`;
}
