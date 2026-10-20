import Link from "next/link";
import { FlaskConicalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

// 局内科研 isn't built yet: its name, that it's planned, and where to vote for it.
export async function ResearchPlanned() {
  const t = (await getDictionary()).dotahub.research;
  const lang = await getLocale();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted">
        <FlaskConicalIcon className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <Badge variant="outline">{t.badge}</Badge>
      </div>
      <p className="text-muted-foreground">{t.description}</p>
      <Link
        href={localePath(lang, "/roadmap#item-dotahub-research")}
        className={buttonVariants({ variant: "outline" })}
      >
        {t.vote}
      </Link>
    </div>
  );
}
