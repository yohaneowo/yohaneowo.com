import "server-only";

// admin's website TradeHub API: the exchange accounts a user connected with read-only keys and what
// admin read with them in the background (balances, positions, fills, income). All private to one
// user, so nothing here is cached: the API route calls this under the signed-in user's id.

export class TradeAdminUnavailable extends Error {}

export type TradeMethod = "GET" | "POST" | "PUT" | "DELETE";

function endpoint() {
  const base = process.env.ADMIN_API_URL;
  const token = process.env.ADMIN_MOVIES_TOKEN;
  if (!base || !token) throw new TradeAdminUnavailable("notConnected");
  return { base: `${base.replace(/\/+$/, "")}/api/v1/bot/website/trade`, token };
}

// Admin's answer: its data on success, else its error code (keyWithdrawals, unknownSymbol, …) with
// the status to pass on.
export async function tradeAdmin(
  path: string,
  method: TradeMethod = "GET",
  body?: unknown,
): Promise<{ status: number; data?: unknown; error?: string }> {
  const { base, token } = endpoint();
  let response: Response;
  try {
    response = await fetch(base + path, {
      method,
      headers: { "X-Movies-Token": token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      // Connecting a key asks the exchange a few questions first.
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new TradeAdminUnavailable("unreachable");
  }
  const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok && result?.success) return { status: 200, data: result.data };
  const detail = result?.detail ?? result?.msg;
  return { status: response.status, error: typeof detail === "string" ? detail : `HTTP ${response.status}` };
}
