import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { PlannedPage } from "../planned";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).moviehub.nav.leaderboard };
}

export default function Page() {
  return <PlannedPage feature="leaderboard" />;
}
