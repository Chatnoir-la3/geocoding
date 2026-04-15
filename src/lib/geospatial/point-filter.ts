import { distance, point } from "@turf/turf";
import type { GeoJsonFeature } from "@/types/geospatial";

/**
 * ポイントデータを中心座標からの距離でフィルタする
 * Python版 point_filter.py の移植
 */
export function filterByDistance(
  features: GeoJsonFeature[],
  centerLat: number,
  centerLon: number,
  maxDistance: number // meters
): GeoJsonFeature[] {
  const center = point([centerLon, centerLat]);

  return features.filter((feature) => {
    if (feature.geometry.type !== "Point") return true;
    const coords = feature.geometry.coordinates as number[];
    const pt = point([coords[0], coords[1]]);
    const dist = distance(center, pt, { units: "meters" });
    return dist <= maxDistance;
  });
}
