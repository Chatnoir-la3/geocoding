/** 建築シミュレーション */

export type BuildingStructure = "rc" | "steel" | "wood";

export interface BuildingParams {
  siteArea: number; // 敷地面積（㎡）
  floorAreaRatio: number; // 容積率（%）
  buildingCoverageRatio: number; // 建蔽率（%）
  structure: BuildingStructure; // 建物構造
}

export interface BuildingResult {
  buildingArea: number; // 建築面積（㎡）
  totalFloorArea: number; // 延床面積（㎡）
  estimatedFloors: number; // 想定階数
  constructionCost: number; // 概算建築費（円）
  structureName: string; // 構造名（日本語）
}

/** 賃料推定 */

export interface RentEstimateParams {
  lat: number;
  lon: number;
  totalFloorArea: number; // 延床面積（㎡）
  structure: BuildingStructure;
}

export interface RentEstimateResult {
  rentPerSqm: number; // 賃料単価（円/㎡/月）
  monthlyRent: number; // 月額賃料（円）
  annualRent: number; // 年額賃料（円）
  confidence: "high" | "medium" | "low"; // 推定信頼度
  sampleCount: number; // 参考取引事例数
  method: "direct" | "indirect"; // 推定方法
  disclaimer: string; // 免責文
}

/** 収益シミュレーション（Phase 2で使用） */

export interface RevenueParams {
  annualRent: number; // 年間賃料（円）
  constructionCost: number; // 建築費（円）
  landPrice: number; // 土地価格（円）
  vacancyRate?: number; // 空室率（デフォルト0.10）
  managementFeeRate?: number; // 管理費率（デフォルト0.05）
  repairReservePerSqm?: number; // 修繕積立（円/㎡/年、デフォルト1000）
  totalFloorArea: number; // 延床面積（㎡）
  loanLtv?: number; // LTV（デフォルト0.70）
  loanRate?: number; // 金利（デフォルト0.02）
  loanTermYears?: number; // 融資期間（デフォルト35）
}

export interface RevenueResult {
  gpiAnnual: number; // 満室想定年収
  effectiveGrossIncome: number; // 実効総収入
  noi: number; // 純営業収益
  grossYield: number; // 表面利回り
  netYield: number; // 実質利回り（FCR）
  annualDebtService: number; // 年間返済額
  cashFlow: number; // 年間キャッシュフロー
  dcr: number; // 借入返済余力
  irr5y: number; // 5年IRR
  irr10y: number; // 10年IRR
}
