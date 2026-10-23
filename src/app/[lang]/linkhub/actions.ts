"use server";
import { getSession } from "@/lib/auth";
import { LinkHubUnavailable, parseLink, type LinkParseError, type LinkParseResult } from "@/lib/linkhub";

// Parses a link for the signed-in visitor. The gateway's own errors come back as they are (the
// page translates the code); "signIn" / "badUrl" / "unavailable" are the site's.
export async function parseLinkAction(input: {
  url: unknown;
  nocache?: unknown;
}): Promise<LinkParseResult | LinkParseError> {
  if (!(await getSession())) return { ok: false, code: "signIn", message: "" };
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!/^https?:\/\/\S{3,2000}$/i.test(url)) return { ok: false, code: "badUrl", message: "" };
  try {
    return await parseLink(url, { nocache: input.nocache === true });
  } catch (error) {
    return {
      ok: false,
      code: "unavailable",
      message: error instanceof LinkHubUnavailable ? error.message : "",
    };
  }
}
