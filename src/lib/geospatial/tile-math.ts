/**
 * 緯度経度をタイル座標に変換する
 * Python版 coordinates_conversion.py の移植
 */

export function latLonToTile(
  lat: number,
  lon: number,
  zoom: number
): { tileX: number; tileY: number; fracX: number; fracY: number } {
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;

  const fracX = ((lon + 180) / 360) * n;
  const fracY =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    n;

  return {
    tileX: Math.floor(fracX),
    tileY: Math.floor(fracY),
    fracX,
    fracY,
  };
}

/**
 * タイル座標の端に近い場合、隣接タイルも含めて返す
 * Python版 point_filter.py の get_surrounding_tiles 相当
 */
export function getSurroundingTiles(
  tileX: number,
  tileY: number,
  fracX: number,
  fracY: number
): Array<{ tileX: number; tileY: number }> {
  const tiles = [{ tileX, tileY }];

  const offsetX = fracX - tileX;
  const offsetY = fracY - tileY;
  const threshold = 0.1;

  const addX: number[] = [];
  const addY: number[] = [];

  if (offsetX < threshold) addX.push(tileX - 1);
  if (offsetX > 1 - threshold) addX.push(tileX + 1);
  if (offsetY < threshold) addY.push(tileY - 1);
  if (offsetY > 1 - threshold) addY.push(tileY + 1);

  for (const x of addX) tiles.push({ tileX: x, tileY });
  for (const y of addY) tiles.push({ tileX, tileY: y });
  for (const x of addX) {
    for (const y of addY) {
      tiles.push({ tileX: x, tileY: y });
    }
  }

  return tiles;
}
