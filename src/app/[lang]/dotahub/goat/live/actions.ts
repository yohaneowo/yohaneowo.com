"use server";

import { updateTag } from "next/cache";
import { getLivePros } from "@/lib/dota/pro";

// The refresh button: fetch the live games again now, unless they're under 15 seconds old (so
// pressing it over and over doesn't hammer OpenDota).
export async function refreshLive() {
  const live = await getLivePros().catch(() => null);
  if (!live || Date.now() - live.at > 15_000) updateTag("goat-live");
}
