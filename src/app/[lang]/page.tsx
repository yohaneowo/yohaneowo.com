import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { Dashboard } from "./_home/dashboard";
import { Landing } from "./_home/landing";

// Signed out: an introduction to the site. Signed in: the account's own dashboard.
async function HomeBody() {
  const lang = await getLocale();
  const t = await getDictionary();
  const session = await getSession();
  if (!session) return <Landing lang={lang} t={t} />;
  return <Dashboard lang={lang} t={t} name={session.user.name} userId={session.user.id} />;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <HomeBody />
    </Suspense>
  );
}
