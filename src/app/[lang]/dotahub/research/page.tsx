import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { ResearchPlanned } from "./planned";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDictionary()).dotahub.research.title };
}

export default function Page() {
  return <ResearchPlanned />;
}
