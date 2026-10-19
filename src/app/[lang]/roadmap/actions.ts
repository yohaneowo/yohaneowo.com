"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { addSuggestion, toggleVote, type SuggestionError } from "@/lib/roadmap-store";

export async function voteForItem(
  itemId: unknown,
): Promise<{ voted: boolean; votes: number } | { error: "signIn" | "closed" }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  if (typeof itemId !== "string") return { error: "closed" };
  const result = await toggleVote(session.user.id, itemId);
  if (!result) return { error: "closed" };
  revalidatePath("/[lang]/roadmap", "page");
  return result;
}

export async function suggestFeature(input: {
  area: unknown;
  title: unknown;
  detail: unknown;
}): Promise<{ error: SuggestionError | "signIn" | null }> {
  const session = await getSession();
  if (!session) return { error: "signIn" };
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const error = await addSuggestion(session.user.id, {
    area: text(input.area),
    title: text(input.title),
    detail: text(input.detail),
  });
  if (!error) revalidatePath("/[lang]/roadmap", "page");
  return { error };
}
