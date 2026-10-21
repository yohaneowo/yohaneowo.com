import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { redirectIfOwn } from "../../../account";
import { accountParam } from "../../../match-list";
import { Notice } from "../../../parts";
import { LoadingPanel } from "../../../loading-panel";
import { ResearchBody, type ResearchParams } from "../../../research/body";

type Params = Promise<{ id: string }>;

// Any account id can be opened, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.research.title };
}

async function Body({ params, searchParams }: { params: Params; searchParams: ResearchParams }) {
  const t = (await getDictionary()).dotahub;
  const id = accountParam((await params).id);
  if (!id) return <Notice>{t.player.notFound}</Notice>;
  // Their own page keeps the chosen matches.
  const sp = await searchParams;
  const q = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  ).toString();
  await redirectIfOwn(id, await getLocale(), `/dotahub/research${q ? `?${q}` : ""}`);
  return <ResearchBody searchParams={searchParams} accountId={id} signedIn />;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: ResearchParams;
}) {
  const t = (await getDictionary()).dotahub.research;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<LoadingPanel kind="research" />}>
        <Body params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
