import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/server";
import { ROADMAP } from "@/lib/roadmap";
import { viewItem } from "../roadmap-view";
import { ChangelogList } from "./changelog-list";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).roadmap.changelog.title };
}

// Everything that has shipped, from the first day of the Discord bot.
export default async function ChangelogPage() {
  const lang = await getLocale();
  const t = (await getDictionary()).roadmap.changelog;
  const shipped = ROADMAP.filter((item) => item.status === "shipped").map((item) => viewItem(item, lang));
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
      </div>
      <ChangelogList items={shipped} />
    </div>
  );
}
