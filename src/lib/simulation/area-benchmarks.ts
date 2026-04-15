/**
 * エリア別ベンチマーク — 都道府県コード別の平均的な賃料・利回り・空室率
 *
 * 概算値であり、実勢との乖離がある点に注意。
 */

export interface AreaBenchmark {
  /** 平均賃料（円/㎡/月） */
  rentPerSqm: number;
  /** 還元利回り */
  capRate: number;
  /** 平均空室率 */
  vacancyRate: number;
}

export const DEFAULT_BENCHMARK: AreaBenchmark = {
  rentPerSqm: 2_000,
  capRate: 0.06,
  vacancyRate: 0.1,
};

const AREA_BENCHMARKS: Record<string, AreaBenchmark> = {
  "13": { rentPerSqm: 4_500, capRate: 0.04, vacancyRate: 0.05 }, // 東京都
  "14": { rentPerSqm: 3_200, capRate: 0.05, vacancyRate: 0.08 }, // 神奈川県
  "27": { rentPerSqm: 3_000, capRate: 0.05, vacancyRate: 0.07 }, // 大阪府
  "23": { rentPerSqm: 2_500, capRate: 0.055, vacancyRate: 0.08 }, // 愛知県
  "40": { rentPerSqm: 2_800, capRate: 0.055, vacancyRate: 0.07 }, // 福岡県
};

/**
 * 都道府県コードからエリアベンチマークを取得する。
 * 未登録の都道府県コードの場合はデフォルト値を返す。
 */
export function getAreaBenchmark(prefCode: string): AreaBenchmark {
  return AREA_BENCHMARKS[prefCode] ?? DEFAULT_BENCHMARK;
}
