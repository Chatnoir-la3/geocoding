import type { GeoJsonFeature } from "@/types/geospatial";

/**
 * モックAPIレスポンス（東京駅付近のサンプルデータ）
 * APIキー未設定時に使用
 */

const MOCK_LAND_PRICE: GeoJsonFeature[] = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [139.7671, 35.6812] },
    properties: {
      L01_006: "東京都千代田区丸の内１丁目",
      L01_001: "2025",
      L01_002: "5500000",
      L01_003: "商業地",
      L01_004: 4150,
      L01_005: "13101",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [139.7690, 35.6820] },
    properties: {
      L01_006: "東京都千代田区丸の内２丁目",
      L01_001: "2025",
      L01_002: "4800000",
      L01_003: "商業地",
      L01_004: 3200,
      L01_005: "13101",
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [139.7650, 35.6800] },
    properties: {
      L01_006: "東京都千代田区大手町１丁目",
      L01_001: "2025",
      L01_002: "6200000",
      L01_003: "商業地",
      L01_004: 5600,
      L01_005: "13101",
    },
  },
];

const MOCK_USAGE_AREA: GeoJsonFeature[] = [
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.764, 35.678],
          [139.772, 35.678],
          [139.772, 35.684],
          [139.764, 35.684],
          [139.764, 35.678],
        ],
      ],
    },
    properties: {
      A29_004: "商業地域",
      A29_005: "80",
      A29_006: "800",
      A29_007: "千代田区",
    },
  },
];

const MOCK_FLOOD: GeoJsonFeature[] = [
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.763, 35.677],
          [139.773, 35.677],
          [139.773, 35.685],
          [139.763, 35.685],
          [139.763, 35.677],
        ],
      ],
    },
    properties: {
      A31_101: "0.5m未満",
      A31_102: "想定最大規模",
      A31_103: "荒川",
    },
  },
];

const MOCK_STATION: GeoJsonFeature[] = [
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [139.7671, 35.6812] },
    properties: {
      name: "東京駅",
      company: "JR東日本",
      passengers: 462589,
      year: 2023,
    },
  },
  {
    type: "Feature",
    geometry: { type: "Point", coordinates: [139.7639, 35.6813] },
    properties: {
      name: "大手町駅",
      company: "東京メトロ",
      passengers: 138420,
      year: 2023,
    },
  },
];

const MOCK_SCHOOL: GeoJsonFeature[] = [
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [139.760, 35.675],
          [139.775, 35.675],
          [139.775, 35.688],
          [139.760, 35.688],
          [139.760, 35.675],
        ],
      ],
    },
    properties: {
      school_name: "千代田区立千代田小学校",
      school_type: "小学校",
      address: "東京都千代田区神田司町2-16",
    },
  },
];

const MOCK_DATA: Record<number, GeoJsonFeature[]> = {
  1: MOCK_LAND_PRICE,
  6: MOCK_USAGE_AREA,
  13: MOCK_SCHOOL,
  17: MOCK_STATION,
  18: MOCK_FLOOD,
};

export function getMockResponse(
  apiId: number,
  _lat: number,
  _lon: number
): GeoJsonFeature[] {
  return MOCK_DATA[apiId] || [];
}

export function isMockModeEnabled(): boolean {
  return !process.env.REINFOLIB_API_KEY;
}
