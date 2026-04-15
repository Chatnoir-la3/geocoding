export interface GeoJsonGeometry {
  type: string;
  coordinates: number[] | number[][] | number[][][] | number[][][][];
}

export interface GeoJsonProperties {
  [key: string]: unknown;
}

export interface GeoJsonFeature {
  type: "Feature";
  geometry: GeoJsonGeometry;
  properties: GeoJsonProperties;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export type ApiDataType = "point" | "polygon" | "line";

export type ApiType = "tile" | "search";

export interface ApiConfig {
  id: number;
  name: string;
  endpoint: string;
  dataType: ApiDataType;
  description: string;
  apiType: ApiType;
  minZoom: number;
  maxZoom: number;
  /** API固有の追加クエリパラメータを構築する */
  buildQueryParams?: () => Record<string, string>;
}

export interface ApiRequestParams {
  lat: number;
  lon: number;
  zoom: number;
  tileX: number;
  tileY: number;
  prefCode?: string;
  year?: number;
}

export interface ApiResult {
  apiId: number;
  apiName: string;
  features: GeoJsonFeature[];
  featureCount: number;
  error?: string;
}

export interface GeospatialToolResult {
  address?: string;
  lat: number;
  lon: number;
  results: ApiResult[];
  mapUrl: string;
  mockMode: boolean;
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  address: string;
  municipality?: string;
  prefCode?: string;
}
