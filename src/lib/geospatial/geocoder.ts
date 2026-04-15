import { GSI_GEOCODER_URL, GSI_REVERSE_GEOCODER_URL } from "@/lib/constants";
import type { GeocodeResult } from "@/types/geospatial";

interface GsiGeocodeFeature {
  type: "Feature";
  geometry: { coordinates: [number, number]; type: "Point" };
  properties: {
    addressCode: string;
    title: string;
    dataSource?: string;
  };
}

/**
 * 検索結果からクエリに最も合致するものを選ぶ
 * 国土地理院APIは部分一致で全国の地名を返すため、スコアリングで最適候補を選択
 */
function pickBestMatch(
  results: GsiGeocodeFeature[],
  query: string
): GsiGeocodeFeature | null {
  if (results.length === 0) return null;

  let best = results[0];
  let bestScore = -1;

  for (const r of results) {
    let score = 0;
    const title = r.properties.title;

    // タイトル完全一致 → 最高スコア
    if (title === query) score += 100;
    // タイトルがクエリを含む
    else if (title.includes(query)) score += 50;
    // クエリがタイトルを含む
    else if (query.includes(title)) score += 30;

    // addressCode（市区町村コード）がある = 特定の場所
    if (r.properties.addressCode) score += 20;

    // dataSource がある = 施設データ（駅など）
    if (r.properties.dataSource) score += 10;

    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return best;
}

/**
 * 住所・地名から緯度経度を検索（国土地理院ジオコーダ）
 */
export async function geocode(query: string): Promise<GeocodeResult | null> {
  const url = `${GSI_GEOCODER_URL}?q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as GsiGeocodeFeature[];
  if (!Array.isArray(data) || data.length === 0) return null;

  const best = pickBestMatch(data, query);
  if (!best) return null;

  const [lon, lat] = best.geometry.coordinates;

  return {
    lat,
    lon,
    address: best.properties.title || query,
    municipality: best.properties.addressCode || undefined,
  };
}

/**
 * 緯度経度から住所を逆引き（国土地理院逆ジオコーダ）
 */
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<{ address: string; prefCode: string; muniCode: string } | null> {
  const url = `${GSI_REVERSE_GEOCODER_URL}?lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.results) return null;

  const result = data.results;
  return {
    address: `${result.lv01Nm || ""}`,
    prefCode: result.mupiCd?.substring(0, 2) || "",
    muniCode: result.mupiCd || "",
  };
}
