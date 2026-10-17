import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { TerminalLoader } from "./terminal-loader";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDictionary();
  return { title: "CoinHub", description: t.coinhub.description };
}

export default function CoinHubPage() {
  return (
    // Fills the viewport under the 3.5rem header; MainFrame drops the width limit on this route.
    <div className="h-[calc(100dvh-3.5rem-1px)] min-h-[420px]">
      <TerminalLoader />
    </div>
  );
}
