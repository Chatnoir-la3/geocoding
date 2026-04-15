import type { RevenueParams, RevenueResult } from "@/types/simulation";

/** デフォルト値 */
const DEFAULTS = {
  vacancyRate: 0.1,
  managementFeeRate: 0.05,
  repairReservePerSqm: 1_000, // 円/㎡/年
  loanLtv: 0.7,
  loanRate: 0.02,
  loanTermYears: 35,
  capRateForExit: 0.05, // 出口還元利回り
} as const;

/**
 * 年間返済額（元利均等）を計算する。
 * PMT = P × r × (1+r)^n / ((1+r)^n - 1)
 */
function annualPayment(
  principal: number,
  annualRate: number,
  years: number,
): number {
  if (annualRate === 0) return principal / years;
  const r = annualRate;
  const n = years;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

/**
 * ローン残高を計算する（n年後）。
 */
function loanBalance(
  principal: number,
  annualRate: number,
  totalYears: number,
  elapsedYears: number,
): number {
  if (annualRate === 0) {
    return principal * (1 - elapsedYears / totalYears);
  }
  const r = annualRate;
  const n = totalYears;
  const t = elapsedYears;
  const factor = Math.pow(1 + r, n);
  const factorT = Math.pow(1 + r, t);
  return principal * (factor - factorT) / (factor - 1);
}

/**
 * IRR（内部収益率）をニュートン法で近似計算する。
 * cashFlows[0] は初期投資（負の値）、以降は各年のCF。
 */
function calculateIrr(cashFlows: number[], guess: number = 0.1): number {
  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-7;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const discountFactor = Math.pow(1 + rate, t);
      npv += cashFlows[t] / discountFactor;
      if (t > 0) {
        derivative -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
      }
    }

    if (Math.abs(npv) < tolerance) break;
    if (derivative === 0) break;
    rate = rate - npv / derivative;
  }

  return rate;
}

/**
 * 収益シミュレーションを実行する。
 */
export function calculateRevenue(params: RevenueParams): RevenueResult {
  const vacancyRate = params.vacancyRate ?? DEFAULTS.vacancyRate;
  const mgmtRate = params.managementFeeRate ?? DEFAULTS.managementFeeRate;
  const repairPerSqm = params.repairReservePerSqm ?? DEFAULTS.repairReservePerSqm;
  const ltv = params.loanLtv ?? DEFAULTS.loanLtv;
  const loanRate = params.loanRate ?? DEFAULTS.loanRate;
  const loanTermYears = params.loanTermYears ?? DEFAULTS.loanTermYears;

  const totalInvestment = params.constructionCost + params.landPrice;

  // 収益計算
  const gpiAnnual = params.annualRent;
  const vacancyLoss = gpiAnnual * vacancyRate;
  const effectiveGrossIncome = gpiAnnual - vacancyLoss;

  const managementFee = gpiAnnual * mgmtRate;
  const repairReserve = params.totalFloorArea * repairPerSqm;
  // 固定資産税概算: 土地(路線価×0.7×1.4%) + 建物(建築費×0.6×1.4%)
  const propertyTaxLand = params.landPrice * 0.7 * 0.014;
  const propertyTaxBuilding = params.constructionCost * 0.6 * 0.014;
  const propertyTax = propertyTaxLand + propertyTaxBuilding;

  const totalExpenses = managementFee + repairReserve + propertyTax;
  const noi = effectiveGrossIncome - totalExpenses;

  // 利回り
  const grossYield = gpiAnnual / totalInvestment;
  const netYield = noi / totalInvestment;

  // 融資
  const loanAmount = totalInvestment * ltv;
  const ads = annualPayment(loanAmount, loanRate, loanTermYears);
  const cashFlow = noi - ads;
  const dcr = ads > 0 ? noi / ads : 0;

  // IRR計算（5年・10年）
  const equity = totalInvestment - loanAmount;
  const exitCapRate = DEFAULTS.capRateForExit;

  const irr5y = calculateIrr(buildCashFlowSeries(
    equity, cashFlow, noi, exitCapRate, loanAmount, loanRate, loanTermYears, 5,
  ));

  const irr10y = calculateIrr(buildCashFlowSeries(
    equity, cashFlow, noi, exitCapRate, loanAmount, loanRate, loanTermYears, 10,
  ));

  return {
    gpiAnnual,
    effectiveGrossIncome,
    noi,
    grossYield,
    netYield,
    annualDebtService: ads,
    cashFlow,
    dcr,
    irr5y,
    irr10y,
  };
}

/**
 * IRR計算用のキャッシュフロー配列を構築する。
 * [初期投資(負), 年次CF, ..., 最終年CF+売却手取り]
 */
function buildCashFlowSeries(
  equity: number,
  annualCf: number,
  noi: number,
  exitCapRate: number,
  loanAmount: number,
  loanRate: number,
  loanTermYears: number,
  holdingYears: number,
): number[] {
  const cfs: number[] = [-equity];

  for (let y = 1; y <= holdingYears; y++) {
    if (y < holdingYears) {
      cfs.push(annualCf);
    } else {
      // 最終年: CF + 売却価格 - ローン残高
      const salePrice = noi / exitCapRate;
      const remaining = loanBalance(loanAmount, loanRate, loanTermYears, holdingYears);
      const saleProceeds = salePrice - remaining;
      cfs.push(annualCf + saleProceeds);
    }
  }

  return cfs;
}
