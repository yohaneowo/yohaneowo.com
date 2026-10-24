import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { dropInstallation, repoTag } from "@/lib/coinhub/x-posts-server";
import { verifyWebhook } from "@/lib/github-app";

// The GitHub App's webhook (needs GITHUB_APP_WEBHOOK_SECRET): a push to a source repo drops its
// cached posts so the bot's new ones show at once instead of within ten minutes; an uninstalled
// App, or repos taken out of it, drop those sources.
export async function POST(request: Request) {
  const body = await request.text();
  if (!verifyWebhook(body, request.headers.get("x-hub-signature-256")))
    return new NextResponse("not found", { status: 404 });
  const event = request.headers.get("x-github-event");
  const payload = JSON.parse(body) as {
    action?: string;
    repository?: { full_name?: string };
    installation?: { id?: number };
    repositories_removed?: Array<{ full_name?: string }>;
  };
  const installation = payload.installation?.id ? String(payload.installation.id) : null;
  if (event === "push" && payload.repository?.full_name)
    revalidateTag(repoTag(payload.repository.full_name), { expire: 0 });
  if (
    event === "installation" &&
    installation &&
    (payload.action === "deleted" || payload.action === "suspend")
  )
    await dropInstallation(installation);
  if (event === "installation_repositories" && installation && payload.action === "removed")
    await dropInstallation(
      installation,
      (payload.repositories_removed ?? []).map((r) => r.full_name ?? "").filter(Boolean),
    );
  return new NextResponse(null, { status: 204 });
}
