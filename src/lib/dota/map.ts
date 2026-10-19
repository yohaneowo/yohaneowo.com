// The Dota 2 map (OpenDota's render) and STRATZ's death positions on it. STRATZ gives map cells:
// the playable map spans cells 64–192 on both axes, x growing east and y growing north.
export const MAP_IMAGE = "https://www.opendota.com/assets/images/dota2/map/detailed_740.webp";
// The same render as JPEG, for Satori (which can't decode WebP).
export const MAP_IMAGE_JPEG = "https://www.opendota.com/assets/images/dota2/map/detailed_740.jpg";
const CELL_MIN = 64;
const CELL_SPAN = 128;

export function mapPoint(x: number, y: number) {
  return {
    left: Math.min(1, Math.max(0, (x - CELL_MIN) / CELL_SPAN)),
    top: Math.min(1, Math.max(0, (CELL_MIN + CELL_SPAN - y) / CELL_SPAN)),
  };
}

// First death light, last death dark (one hue, so the order reads without a legend of colors).
export function orderColor(index: number, count: number) {
  const f = count <= 1 ? 1 : index / (count - 1);
  const light = [252, 165, 165];
  const dark = [127, 29, 29];
  const mix = light.map((l, i) => Math.round(l + (dark[i] - l) * f));
  return `rgb(${mix.join(",")})`;
}

export function clock(seconds: number) {
  const sign = seconds < 0 ? "-" : "";
  const s = Math.abs(seconds);
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
