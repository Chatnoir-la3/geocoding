import { MAP_BASE_URL, MAP_URL_ZOOM } from "@/lib/constants";

/**
 * 不動産情報ライブラリの地図URLを生成する
 * Python版 map_url_generator.py の移植
 */

const API_ID_TO_LAYER: Record<number, string> = {
  1: "landprice_official",       // 地価公示
  2: "landprice_prefectural",    // 都道府県地価調査
  3: "transaction_price",        // 不動産取引価格
  4: "appraisal_report",         // 鑑定評価書情報
  5: "transaction_yield",        // 成約価格情報
  6: "usage_area",               // 用途地域
  7: "fire_prevention",          // 防火・準防火地域
  8: "urban_plan",               // 都市計画区域
  9: "district_plan",            // 地区計画
  10: "height_district",         // 高度利用地区
  11: "urban_road",              // 都市計画道路
  12: "location_optimization",   // 立地適正化計画
  13: "school_district",         // 学区
  14: "kindergarten",            // 幼稚園・保育園
  15: "medical",                 // 医療機関
  16: "library",                 // 図書館
  17: "station_passengers",      // 駅乗降客数
  18: "flood",                   // 洪水浸水想定
  19: "sediment_disaster",       // 土砂災害警戒区域
  20: "tsunami",                 // 津波浸水想定
  21: "storm_surge",             // 高潮浸水想定
  22: "landslide_prevention",    // 地すべり防止地区
  23: "steep_slope",             // 急傾斜地崩壊危険区域
  24: "disaster_danger",         // 災害危険区域
  25: "liquefaction",            // 液状化
  26: "shelter",                 // 指定緊急避難場所
  27: "disaster_history",        // 災害履歴
  30: "large_embankment",        // 大規模盛土造成地
};

export function buildMapUrl(
  lat: number,
  lon: number,
  apiIds: number[]
): string {
  const layers = apiIds
    .map((id) => API_ID_TO_LAYER[id])
    .filter(Boolean);

  const params = new URLSearchParams();
  params.set("lat", lat.toFixed(6));
  params.set("lon", lon.toFixed(6));
  params.set("z", MAP_URL_ZOOM.toString());
  if (layers.length > 0) {
    params.set("layers", layers.join(","));
  }

  return `${MAP_BASE_URL}#${params.toString()}`;
}
