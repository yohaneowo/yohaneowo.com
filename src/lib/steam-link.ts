import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { steamAccount } from "@/db/schema";
import type { Locale } from "@/i18n/config";

// DotaHub's "sign in with Steam": Steam speaks OpenID 2.0, which Better Auth doesn't, so the link
// is made here. The person is sent to Steam with a signed state (bound to their site account,
// expiring soon; a cookie holds the same nonce so another browser can't use it), and Steam's
// answer is checked by asking Steam itself (check_authentication) before the SteamID is trusted.

const OPENID = "https://steamcommunity.com/openid/login";
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
export const STEAM_STATE_COOKIE = "steam_connect";
const TTL_MS = 10 * 60 * 1000;
// SteamID64 = this + Dota's 32-bit account id.
const STEAM64_BASE = BigInt("76561197960265728");

type SteamState = { nonce: string; userId: string; lang: Locale; exp: number };

function sign(payload: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`steam:${payload}`).digest("base64url");
}

export function publicOrigin(fallback: string) {
  return process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") ?? fallback;
}

// Where to send the browser, and the cookie to set alongside.
export function startSteamLogin(input: { userId: string; lang: Locale; origin: string }) {
  const state: SteamState = {
    userId: input.userId,
    lang: input.lang,
    nonce: randomBytes(16).toString("base64url"),
    exp: Date.now() + TTL_MS,
  };
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const returnTo = `${input.origin}/api/steam/callback?state=${payload}.${sign(payload)}`;
  const url = new URL(OPENID);
  url.search = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": input.origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  }).toString();
  return { url: url.toString(), cookie: state.nonce };
}

export function readSteamState(token: string | null, cookie: string | undefined): SteamState | null {
  if (!token || !cookie) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
    return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString()) as SteamState;
    return state.nonce === cookie && state.exp > Date.now() ? state : null;
  } catch {
    return null;
  }
}

// Steam's answer on the callback URL: the SteamID64 when Steam confirms it signed it for this
// return address, else null.
export async function verifySteamLogin(url: URL, origin: string): Promise<string | null> {
  const params = url.searchParams;
  if (params.get("openid.mode") !== "id_res") return null;
  const returnTo = params.get("openid.return_to") ?? "";
  if (!returnTo.startsWith(`${origin}/api/steam/callback`)) return null;
  const claimed = CLAIMED_ID.exec(params.get("openid.claimed_id") ?? "");
  if (!claimed) return null;
  const check = new URLSearchParams();
  for (const [key, value] of params) if (key.startsWith("openid.")) check.set(key, value);
  check.set("openid.mode", "check_authentication");
  const response = await fetch(OPENID, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: check.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return /(^|\n)is_valid:true(\n|$)/.test(await response.text()) ? claimed[1] : null;
}

export function dotaAccountId(steamId: string) {
  return Number(BigInt(steamId) - STEAM64_BASE);
}

export function steamIdOf(accountId: number) {
  return String(BigInt(accountId) + STEAM64_BASE);
}

export async function getSteamAccount(userId: string) {
  const [row] = await db.select().from(steamAccount).where(eq(steamAccount.userId, userId)).limit(1);
  return row ?? null;
}

// The site account that linked this Steam account, if any.
export async function getSteamOwner(steamId: string) {
  const [row] = await db
    .select({ userId: steamAccount.userId })
    .from(steamAccount)
    .where(eq(steamAccount.steamId, steamId))
    .limit(1);
  return row?.userId ?? null;
}

export class SteamTaken extends Error {}

// Links (or relinks) the Steam account; one Steam account belongs to one site account.
export async function linkSteamAccount(userId: string, steamId: string) {
  const [owner] = await db
    .select({ userId: steamAccount.userId })
    .from(steamAccount)
    .where(eq(steamAccount.steamId, steamId))
    .limit(1);
  if (owner && owner.userId !== userId) throw new SteamTaken();
  await db
    .insert(steamAccount)
    .values({ userId, steamId })
    .onConflictDoUpdate({ target: steamAccount.userId, set: { steamId, linkedAt: new Date() } });
}

export async function unlinkSteamAccount(userId: string) {
  await db.delete(steamAccount).where(eq(steamAccount.userId, userId));
}
