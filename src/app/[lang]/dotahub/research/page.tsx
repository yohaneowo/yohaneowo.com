import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary } from "@/i18n/server";
import { dotaViewer } from "../account";
import { LoadingPanel } from "../loading-panel";
import { ResearchBody, type ResearchParams } from "./body";

// The chosen matches are in the query, so there is no static shell to prerender.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.research.title };
}

async function Own({ searchParams }: { searchParams: ResearchParams }) {
  const viewer = await dotaViewer();
  return (
    <ResearchBody
      searchParams={searchParams}
      accountId={viewer.state === "linked" ? viewer.accountId : null}
      signedIn={viewer.state === "linked"}
    />
  );
}

export default async function Page({ searchParams }: { searchParams: ResearchParams }) {
  const t = (await getDictionary()).dotahub.research;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<LoadingPanel kind="research" />}>
        <Own searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
