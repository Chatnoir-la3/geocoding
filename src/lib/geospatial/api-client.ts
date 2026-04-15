import { LIBRARY_API_URL, DEFAULT_ZOOM } from "@/lib/constants";
import { getApiConfig } from "./api-registry";
import { latLonToTile, getSurroundingTiles } from "./tile-math";
import { filterByDistance } from "./point-filter";
import { filterByPolygonContains } from "./polygon-filter";
import { getMockResponse } from "@/lib/mock/mock-responses";
import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  ApiResult,
  ApiConfig,
} from "@/types/geospatial";

const isMockMode = () => !process.env.REINFOLIB_API_KEY;

/**
 * タイルAPIからGeoJSONデータを取得する
 *
 * URL形式: ${baseUrl}/${endpoint}?response_format=geojson&z=${zoom}&x=${tileX}&y=${tileY}
 * + API固有の追加クエリパラメータ
 */
async function fetchTileData(
  config: ApiConfig,
  zoom: number,
  tileX: number,
  tileY: number
): Promise<GeoJsonFeature[]> {
  const apiKey = process.env.REINFOLIB_API_KEY;
  if (!apiKey) return [];

  // クエリパラメータを構築
  const params = new URLSearchParams({
    response_format: "geojson",
    z: String(zoom),
    x: String(tileX),
    y: String(tileY),
  });

  // API固有の追加パラメータを付加
  if (config.buildQueryParams) {
    const extra = config.buildQueryParams();
    for (const [key, value] of Object.entries(extra)) {
      params.set(key, value);
    }
  }

  const url = `${LIBRARY_API_URL}/${config.endpoint}?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
    },
  });

  if (!res.ok) {
    console.error(
      `API error: ${config.endpoint} z=${zoom}&x=${tileX}&y=${tileY} -> ${res.status}`
    );
    return [];
  }

  const data = (await res.json()) as GeoJsonFeatureCollection;
  return data.features || [];
}

/**
 * 指定のAPIから地理空間データを取得する
 */
export async function fetchGeospatialData(
  apiId: number,
  lat: number,
  lon: number,
  distance: number = 425
): Promise<ApiResult> {
  const config = getApiConfig(apiId);
  if (!config) {
    return {
      apiId,
      apiName: `Unknown API ${apiId}`,
      features: [],
      featureCount: 0,
      error: `API ID ${apiId} は存在しません`,
    };
  }

  // 検索APIはタイル取得に非対応
  if (config.apiType === "search") {
    return {
      apiId,
      apiName: config.name,
      features: [],
      featureCount: 0,
      error: `${config.name}は検索API（apiType: "search"）のため、現在未対応です`,
    };
  }

  // モックモード
  if (isMockMode()) {
    const mockData = getMockResponse(apiId, lat, lon);
    return {
      apiId,
      apiName: config.name,
      features: mockData,
      featureCount: mockData.length,
    };
  }

  try {
    // ズームレベルをAPI対応範囲に調整
    const zoom = Math.max(config.minZoom, Math.min(DEFAULT_ZOOM, config.maxZoom));
    const { tileX, tileY, fracX, fracY } = latLonToTile(lat, lon, zoom);

    let allFeatures: GeoJsonFeature[] = [];

    if (config.dataType === "point") {
      // ポイントデータ: 周辺タイルも取得してから距離フィルタ
      const tiles = getSurroundingTiles(tileX, tileY, fracX, fracY);
      const tileResults = await Promise.all(
        tiles.map((t) =>
          fetchTileData(config, zoom, t.tileX, t.tileY)
        )
      );
      allFeatures = tileResults.flat();
      allFeatures = filterByDistance(allFeatures, lat, lon, distance);
    } else {
      // ポリゴン・ラインデータ: 対象タイルのみ取得して座標包含フィルタ
      allFeatures = await fetchTileData(config, zoom, tileX, tileY);
      if (config.dataType === "polygon") {
        allFeatures = filterByPolygonContains(allFeatures, lat, lon);
      }
    }

    return {
      apiId,
      apiName: config.name,
      features: allFeatures,
      featureCount: allFeatures.length,
    };
  } catch (error) {
    return {
      apiId,
      apiName: config.name,
      features: [],
      featureCount: 0,
      error: `データ取得エラー: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

/**
 * 複数のAPIからデータを並列取得する
 */
export async function fetchMultipleApis(
  apiIds: number[],
  lat: number,
  lon: number,
  distance?: number
): Promise<ApiResult[]> {
  const results = await Promise.all(
    apiIds.map((id) => fetchGeospatialData(id, lat, lon, distance))
  );
  return results;
}
