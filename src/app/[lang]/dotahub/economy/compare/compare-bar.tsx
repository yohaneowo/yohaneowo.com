"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, XIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { MAX_TARGETS, parseAccount } from "./series";

export type CompareTarget = { key: string; label: string; color: string };

// Who to compare with, at the top of the economy page: up to two players (pasted or picked from
// the people played with most) and / or the bracket. The choice lives in the address (?vs=…).
export function CompareBar({
  path,
  ownerId,
  targets,
  peers,
  bracketAvailable,
}: {
  // The economy page's own address (the language prefix included).
  path: string;
  ownerId: number;
  targets: CompareTarget[];
  peers: { id: number; name: string }[];
  bracketAvailable: boolean;
}) {
  const { t: dict } = useLocale();
  const t = dict.dotahub.compare;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const keys = targets.map((x) => x.key);
  const full = keys.length >= MAX_TARGETS;

  const go = (next: string[]) => {
    setOpen(false);
    setInput("");
    setError(false);
    router.push(next.length ? `${path}?vs=${next.join(",")}` : path, { scroll: false });
  };
  const addPlayer = (id: number | null) => {
    if (!id || id === ownerId) return setError(true);
    if (!keys.includes(String(id))) go([...keys, String(id)]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2">
      <span className="text-xs text-muted-foreground">{t.label}</span>
      {targets.length === 0 && <span className="text-xs text-muted-foreground">{t.none}</span>}
      {targets.map((x) => (
        <span
          key={x.key}
          className="flex items-center gap-1.5 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
          style={{ borderColor: x.color }}
        >
          <span className="size-2 rounded-full" style={{ background: x.color }} aria-hidden />
          {x.label}
          <button
            type="button"
            onClick={() => go(keys.filter((k) => k !== x.key))}
            aria-label={t.remove(x.label)}
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <XIcon className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      {!full && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground">
            <PlusIcon className="size-3" aria-hidden />
            {t.addPlayer}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80">
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                addPlayer(parseAccount(input));
              }}
            >
              <input
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setError(false);
                }}
                placeholder={t.placeholder}
                className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
              />
              <button type="submit" className="h-8 rounded-md border px-3 text-xs hover:bg-muted">
                {t.add}
              </button>
            </form>
            {error && <p className="text-xs text-destructive">{t.badId}</p>}
            {peers.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t.peers}</span>
                <div className="flex flex-wrap gap-1">
                  {peers
                    .filter((p) => !keys.includes(String(p.id)))
                    .map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addPlayer(p.id)}
                        className="max-w-36 truncate rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted"
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
      {bracketAvailable && !keys.includes("bracket") && !full && (
        <button
          type="button"
          onClick={() => go([...keys, "bracket"])}
          className={cn(
            "flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground",
          )}
        >
          <PlusIcon className="size-3" aria-hidden />
          {t.addBracket}
        </button>
      )}
      {full && <span className="text-xs text-muted-foreground">{t.full}</span>}
    </div>
  );
}
