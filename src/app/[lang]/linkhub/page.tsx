import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { linkhubConfigured, listPlatforms } from "@/lib/linkhub";
import { LinkParser } from "./parser";

export const metadata: Metadata = { title: "LinkHub" };

// Paste a link, get the post and its media back from LinkHub (lib/linkhub.ts). Parsing needs a
// signed-in visitor (the gateway counts the site's own quota); the platform list is public.
export default async function LinkHubPage() {
  const t = (await getDictionary()).linkhub;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted/40" />}>
        <ParserGate />
      </Suspense>
      <Suspense fallback={null}>
        <Platforms />
      </Suspense>
    </div>
  );
}

async function ParserGate() {
  const t = (await getDictionary()).linkhub;
  if (!linkhubConfigured()) return <p className="text-muted-foreground">{t.notConfigured}</p>;
  const session = await getSession();
  return <LinkParser signedIn={Boolean(session)} />;
}

// The platforms the gateway knows, with how many of their parsers are healthy right now.
async function Platforms() {
  const t = (await getDictionary()).linkhub;
  if (!linkhubConfigured()) return null;
  let rows;
  try {
    rows = await listPlatforms();
  } catch {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-muted-foreground">{t.platforms}</h2>
      <div className="flex flex-wrap gap-2">
        {rows.map((p) => (
          <Badge
            key={p.platform}
            variant={p.healthy > 0 ? "secondary" : "outline"}
            title={t.platformsHint(p.healthy, p.adapters)}
            className={p.healthy === 0 ? "text-muted-foreground" : undefined}
          >
            {t.platformNames[p.platform] ?? p.platform}
            <span className="ml-1 font-normal text-muted-foreground">
              {p.healthy}/{p.adapters}
            </span>
          </Badge>
        ))}
      </div>
    </section>
  );
}
