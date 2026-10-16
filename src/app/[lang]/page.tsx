import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NAV_ITEMS } from "@/components/site-nav";
import { localePath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/server";

export default async function Home() {
  const lang = await getLocale();
  const t = await getDictionary();
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">yohaneowo</h1>
        <p className="text-muted-foreground">{t.site.tagline}</p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={localePath(lang, item.href)} className="group">
            <Card className="h-full transition-colors group-hover:bg-muted/50">
              <CardHeader>
                <item.icon className="mb-2 size-5 text-muted-foreground" />
                <CardTitle>{t.nav[item.key].title}</CardTitle>
                <CardDescription>{t.nav[item.key].description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
