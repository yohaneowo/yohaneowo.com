import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary } from "@/i18n/server";
import { getSession } from "@/lib/auth";
import { getDiscordAccount } from "@/lib/discord-account";
import { DiscordConnect } from "./discord-connect";

// The link the Discord bot hands out. Signed out: sign in with Discord. Signed in (with Google,
// say): link Discord to this account. Either way the person lands on the movie page afterwards.
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).connect.title };
}

async function ConnectContent() {
  const session = await getSession();
  const linked = session ? await getDiscordAccount(session.user.id) : null;
  return <DiscordConnect mode={!session ? "signIn" : linked ? "done" : "link"} />;
}

export default async function ConnectDiscordPage() {
  const t = await getDictionary();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-10">
      <Suspense fallback={<p role="status">{t.connect.working}</p>}>
        <ConnectContent />
      </Suspense>
    </div>
  );
}
