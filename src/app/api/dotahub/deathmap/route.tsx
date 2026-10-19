import { ImageResponse } from "next/og";
import { mapPoint, MAP_IMAGE_JPEG, orderColor } from "@/lib/dota/map";
import { getStratzMatch } from "@/lib/dota/stratz";

// One player's deaths in one match as a PNG (the map with numbered markers in order), for the
// bot's DM after a ranked match: /api/dotahub/deathmap?match=<match id>&account=<account id>.
const SIZE = 640;
const DOT = 26;

// The map is the same for every image: fetch it once per process, as a data URI for Satori.
let map: Promise<string> | null = null;
function mapImage() {
  map ??= fetch(MAP_IMAGE_JPEG, { signal: AbortSignal.timeout(15_000) })
    .then(async (response) => {
      if (!response.ok) throw new Error(`map ${response.status}`);
      return `data:image/jpeg;base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    })
    .catch((error) => {
      map = null;
      throw error;
    });
  return map;
}

function id(value: string | null) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const matchId = id(params.get("match"));
  const accountId = id(params.get("account"));
  if (!matchId || !accountId) return new Response("bad request", { status: 400 });
  const [match, background] = await Promise.all([getStratzMatch(matchId).catch(() => null), mapImage()]);
  const player = match?.parsed ? match.players.find((p) => p.steamAccountId === accountId) : undefined;
  if (!player) return new Response("not found", { status: 404 });
  const events = player.deathEvents;
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: SIZE, height: SIZE, background: "#101318" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws plain <img> */}
      <img src={background} alt="" width={SIZE} height={SIZE} style={{ position: "absolute", inset: 0 }} />
      {events.map((e, i) => {
        const { left, top } = mapPoint(e.x, e.y);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: left * SIZE - DOT / 2,
              top: top * SIZE - DOT / 2,
              width: DOT,
              height: DOT,
              borderRadius: DOT,
              background: orderColor(i, events.length),
              border: "2px solid #ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: i / Math.max(1, events.length - 1) > 0.45 ? "#ffffff" : "#450a0a",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {i + 1}
          </div>
        );
      })}
    </div>,
    {
      width: SIZE,
      height: SIZE,
      // Parsed matches don't change.
      headers: { "Cache-Control": "public, max-age=86400, immutable" },
    },
  );
}
