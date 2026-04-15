import type { ApiConfig, ApiDataType } from "@/types/geospatial";

/**
 * 不動産情報ライブラリAPI レジストリ
 *
 * URL パターン（タイルAPI）:
 *   ${baseUrl}/${endpoint}?response_format=geojson&z=${zoom}&x=${tileX}&y=${tileY}
 *
 * 検索API（XCT001等）はタイルAPIとは異なるインターフェース。
 */

/**
 * 現在の年度に基づくデフォルトパラメータを生成するヘルパー
 */
function currentQuarter(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  // 直近1年分: 前年同四半期 〜 今年同四半期
  return {
    from: `${year - 1}${quarter}`,
    to: `${year}${quarter}`,
  };
}

interface ApiRegistryEntry extends ApiConfig {
  layerName?: string;
}

export const API_REGISTRY: Record<number, ApiRegistryEntry> = {
  // === 価格情報（タイルAPI） ===
  1: {
    id: 1,
    name: "地価公示",
    endpoint: "XPT002",
    dataType: "point",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "国土交通省が毎年公示する標準地の地価",
    buildQueryParams: () => ({ year: String(new Date().getFullYear() - 1) }),
  },
  2: {
    id: 2,
    name: "都道府県地価調査",
    endpoint: "XPT002",
    dataType: "point",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "都道府県が調査した基準地の地価（地価公示と同一APIエンドポイント）",
    buildQueryParams: () => ({ year: String(new Date().getFullYear() - 1) }),
  },
  3: {
    id: 3,
    name: "不動産取引価格情報",
    endpoint: "XPT001",
    dataType: "point",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "不動産取引のアンケート調査に基づく取引価格情報",
    buildQueryParams: () => {
      const { from, to } = currentQuarter();
      return { from, to, priceClassification: "01" };
    },
  },
  4: {
    id: 4,
    name: "鑑定評価書情報",
    endpoint: "XCT001",
    dataType: "point",
    apiType: "search",
    minZoom: 0,
    maxZoom: 0,
    description: "不動産鑑定評価書の情報（検索API — タイル非対応）",
  },
  5: {
    id: 5,
    name: "成約価格情報",
    endpoint: "XPT001",
    dataType: "point",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "不動産取引の成約価格情報",
    buildQueryParams: () => {
      const { from, to } = currentQuarter();
      return { from, to, priceClassification: "02" };
    },
  },

  // === 都市計画（全てタイルAPI） ===
  6: {
    id: 6,
    name: "用途地域",
    endpoint: "XKT002",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "都市計画法に基づく用途地域の指定状況",
  },
  7: {
    id: 7,
    name: "防火・準防火地域",
    endpoint: "XKT014",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "防火地域・準防火地域の指定状況",
  },
  8: {
    id: 8,
    name: "都市計画区域",
    endpoint: "XKT001",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "都市計画区域・市街化区域・市街化調整区域の区分",
  },
  9: {
    id: 9,
    name: "地区計画",
    endpoint: "XKT023",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "地区計画の策定状況",
  },
  10: {
    id: 10,
    name: "高度利用地区",
    endpoint: "XKT024",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "高度利用地区の指定状況",
  },
  11: {
    id: 11,
    name: "都市計画道路",
    endpoint: "XKT030",
    dataType: "line",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "都市計画道路の計画・整備状況",
  },
  12: {
    id: 12,
    name: "立地適正化計画",
    endpoint: "XKT003",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "居住誘導区域・都市機能誘導区域の設定状況",
  },

  // === 周辺施設（タイルAPI） ===
  13: {
    id: 13,
    name: "学区（小学校）",
    endpoint: "XKT004",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "小学校の学区情報",
  },
  14: {
    id: 14,
    name: "幼稚園・保育園",
    endpoint: "XKT007",
    dataType: "point",
    apiType: "tile",
    minZoom: 13,
    maxZoom: 15,
    description: "幼稚園・保育園の所在地",
  },
  15: {
    id: 15,
    name: "医療機関",
    endpoint: "XKT010",
    dataType: "point",
    apiType: "tile",
    minZoom: 13,
    maxZoom: 15,
    description: "医療機関の所在地",
  },
  16: {
    id: 16,
    name: "図書館",
    endpoint: "XKT017",
    dataType: "point",
    apiType: "tile",
    minZoom: 13,
    maxZoom: 15,
    description: "図書館の所在地",
  },
  17: {
    id: 17,
    name: "駅乗降客数",
    endpoint: "XKT015",
    dataType: "point",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "鉄道駅の乗降客数統計",
  },

  // === 災害リスク（タイルAPI） ===
  18: {
    id: 18,
    name: "洪水浸水想定区域",
    endpoint: "XKT026",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 14,
    maxZoom: 15,
    description: "洪水による浸水が想定される区域と浸水深",
  },
  19: {
    id: 19,
    name: "土砂災害警戒区域",
    endpoint: "XKT029",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "土砂災害警戒区域・特別警戒区域",
  },
  20: {
    id: 20,
    name: "津波浸水想定",
    endpoint: "XKT028",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 14,
    maxZoom: 15,
    description: "津波による浸水が想定される区域",
  },
  21: {
    id: 21,
    name: "高潮浸水想定区域",
    endpoint: "XKT027",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 13,
    maxZoom: 15,
    description: "高潮による浸水が想定される区域",
  },
  22: {
    id: 22,
    name: "地すべり防止地区",
    endpoint: "XKT021",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "地すべり防止法に基づく地すべり防止区域",
  },
  23: {
    id: 23,
    name: "急傾斜地崩壊危険区域",
    endpoint: "XKT022",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "急傾斜地の崩壊による災害の防止に関する法律に基づく危険区域",
  },
  24: {
    id: 24,
    name: "災害危険区域",
    endpoint: "XKT016",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "建築基準法に基づく災害危険区域",
  },
  25: {
    id: 25,
    name: "液状化の発生傾向図",
    endpoint: "XKT025",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "液状化の発生傾向を示すマップ",
  },
  26: {
    id: 26,
    name: "指定緊急避難場所",
    endpoint: "XGT001",
    dataType: "point",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "災害時の指定緊急避難場所",
  },
  27: {
    id: 27,
    name: "災害履歴",
    endpoint: "XST001",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 9,
    maxZoom: 15,
    description: "過去の災害履歴記録",
  },

  // === 地形・地盤 ===
  30: {
    id: 30,
    name: "大規模盛土造成地",
    endpoint: "XKT020",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "大規模な盛土造成が行われた土地の分布",
  },

  // === 新規追加 ===
  31: {
    id: 31,
    name: "中学校区",
    endpoint: "XKT005",
    dataType: "polygon",
    apiType: "tile",
    minZoom: 11,
    maxZoom: 15,
    description: "中学校の学区情報",
  },
  32: {
    id: 32,
    name: "学校",
    endpoint: "XKT006",
    dataType: "point",
    apiType: "tile",
    minZoom: 13,
    maxZoom: 15,
    description: "学校の所在地",
  },
  33: {
    id: 33,
    name: "福祉施設",
    endpoint: "XKT011",
    dataType: "point",
    apiType: "tile",
    minZoom: 13,
    maxZoom: 15,
    description: "福祉施設の所在地",
  },
};

/** API番号からAPI設定を取得 */
export function getApiConfig(apiId: number): ApiRegistryEntry | undefined {
  return API_REGISTRY[apiId];
}

/** 全APIの一覧を取得 */
export function getAllApiConfigs(): ApiRegistryEntry[] {
  return Object.values(API_REGISTRY);
}

/** データタイプ別にAPIをグループ化 */
export function getApisByDataType(
  dataType: ApiDataType
): ApiRegistryEntry[] {
  return Object.values(API_REGISTRY).filter((api) => api.dataType === dataType);
}

/** API名からAPI番号を逆引き */
export function findApiByName(name: string): ApiRegistryEntry | undefined {
  return Object.values(API_REGISTRY).find(
    (api) => api.name.includes(name) || api.description.includes(name)
  );
}
