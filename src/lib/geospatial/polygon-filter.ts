import { booleanPointInPolygon, point } from "@turf/turf";
import type { GeoJsonFeature } from "@/types/geospatial";

/**
 * ポリゴン/マルチポリゴンが指定座標を含むかでフィルタする
 * Python版 polygon_filter.py の移植
 */
export function filterByPolygonContains(
  features: GeoJsonFeature[],
  lat: number,
  lon: number
): GeoJsonFeature[] {
  const pt = point([lon, lat]);

  return features.filter((feature) => {
    const geomType = feature.geometry.type;
    if (geomType === "Polygon" || geomType === "MultiPolygon") {
      try {
        return booleanPointInPolygon(
          pt,
          feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
        );
      } catch {
        return false;
      }
    }
    // non-polygon features pass through
    return true;
  });
}
