"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { ROADMAP_AREAS, VOTABLE, type RoadmapArea } from "@/lib/roadmap";
import { cn } from "@/lib/utils";
import { voteForItem } from "./actions";
import { ItemDetails } from "./item-parts";
import { AREA_COLOR, type ViewItem } from "./roadmap-view";

type Sort = "votes" | "newest";

// The roadmap as one card per area: how much of it has shipped (a ring), what is being worked on
// now (in progress and testing, with their progress), what comes next (considering, by votes),
// everything shipped (one line each, newest first), and what's paused or not being done. Votes change optimistically and settle
// on the server's count.
export function RoadmapBoard({
  items,
  counts,
  mine,
  signedIn,
}: {
  items: ViewItem[];
  counts: Record<string, number>;
  mine: string[];
  signedIn: boolean;
}) {
  const { t: dict, href } = useLocale();
  const t = dict.roadmap;
  const [sort, setSort] = useState<Sort>("votes");
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [votes, setVotes] = useState(counts);
  const [voted, setVoted] = useState(() => new Set(mine));
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();

  // A link to one item (#item-…, e.g. from a planned page): the items stream in after the page,
  // so the browser can't jump there by itself. Open it, scroll to it and mark it.
  useEffect(() => {
    function reveal() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("item-")) return;
      setOpen((current) => new Set(current).add(id.slice(5)));
      requestAnimationFrame(() => {
        const row = document.getElementById(id);
        if (!row) return;
        document.querySelectorAll("[data-linked]").forEach((el) => el.removeAttribute("data-linked"));
        row.setAttribute("data-linked", "");
        row.scrollIntoView({ block: "center" });
      });
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

  function toggleOpen(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function vote(id: string) {
    const had = voted.has(id);
    const flip = (set: Set<string>, on: boolean) => {
      const next = new Set(set);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    };
    setVoted((current) => flip(current, !had));
    setVotes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? -1 : 1)) }));
    setError(false);
    startTransition(async () => {
      const result = await voteForItem(id);
      if ("error" in result) {
        // Put it back as it was.
        setVoted((current) => flip(current, had));
        setVotes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? 1 : -1)) }));
        setError(true);
        return;
      }
      setVotes((current) => ({ ...current, [id]: result.votes }));
    });
  }

  function voteButton(item: ViewItem) {
    const count = votes[item.id] ?? 0;
    if (!VOTABLE.includes(item.status))
      return count > 0 ? (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t.votes(count)}</span>
      ) : null;
    const isMine = voted.has(item.id);
    const look =
      "flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs tabular-nums transition-colors";
    return signedIn ? (
      <button
        type="button"
        onClick={() => vote(item.id)}
        aria-pressed={isMine}
        aria-label={`${isMine ? t.voted : t.vote}: ${item.title}`}
        className={cn(
          look,
          isMine
            ? "border-primary bg-primary text-primary-foreground"
            : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
        )}
      >
        <ChevronUpIcon className="size-3.5" aria-hidden />
        {count}
      </button>
    ) : (
      <Link
        href={href("/login?next=/roadmap")}
        title={t.voteHint}
        aria-label={`${t.voteHint}: ${item.title}`}
        className={cn(look, "text-muted-foreground hover:text-foreground")}
      >
        <ChevronUpIcon className="size-3.5" aria-hidden />
        {count}
      </Link>
    );
  }

  // One item in an area card: title, status, progress, its vote button, and details on demand.
  function row(item: ViewItem) {
    const isOpen = open.has(item.id);
    // Shipped items take one line each (name and date), so every one of them fits.
    const compact = item.status === "shipped";
    const done = item.steps.filter((s) => s.done).length;
    const hasDetails = Boolean(
      item.why || item.steps.length || item.notes.length || item.links.length || item.reason,
    );
    return (
      <li
        key={item.id}
        id={`item-${item.id}`}
        className={cn(
          "scroll-mt-32 rounded-lg px-2 transition-colors data-linked:bg-muted data-linked:ring-1 data-linked:ring-primary/50",
          compact ? "py-1" : "py-2",
        )}
      >
        <div className={cn("flex gap-2", compact ? "items-baseline" : "items-start")}>
          <button
            type="button"
            aria-expanded={hasDetails ? isOpen : undefined}
            disabled={!hasDetails}
            onClick={() => toggleOpen(item.id)}
            className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
          >
            <span className="flex items-center gap-1 font-medium">
              {item.title}
              {hasDetails && (
                <ChevronDownIcon
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              )}
            </span>
            {!compact && (
              <span className="text-xs text-muted-foreground">
                {item.status === "considering" ? item.summary : t.statuses[item.status]}
              </span>
            )}
            {item.steps.length > 0 && item.status !== "shipped" && (
              <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(done / item.steps.length) * 100}%`,
                      background: AREA_COLOR[item.area],
                    }}
                  />
                </span>
                {t.progress(done, item.steps.length)}
              </span>
            )}
          </button>
          {compact ? (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.shipped}</span>
          ) : (
            voteButton(item)
          )}
        </div>
        {isOpen && (
          <div className="pl-0">
            {item.status !== "considering" && (
              <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>
            )}
            <ItemDetails item={item} />
          </div>
        )}
      </li>
    );
  }

  const areas = ROADMAP_AREAS.filter((area) => items.some((item) => item.area === area));

  function areaCard(area: RoadmapArea) {
    const mineItems = items.filter((item) => item.area === area);
    const counted = mineItems.filter((item) => item.status !== "declined");
    const shippedAll = mineItems
      .filter((item) => item.status === "shipped")
      .sort((a, b) => (b.shipped ?? "").localeCompare(a.shipped ?? ""));
    const now = mineItems.filter((item) => item.status === "building" || item.status === "testing");
    const next = mineItems
      .filter((item) => item.status === "considering")
      .sort((a, b) =>
        sort === "votes"
          ? (votes[b.id] ?? 0) - (votes[a.id] ?? 0) || b.added.localeCompare(a.added)
          : b.added.localeCompare(a.added),
      );
    const onHold = mineItems.filter((item) => item.status === "paused" || item.status === "declined");
    const share = counted.length ? shippedAll.length / counted.length : 0;
    const color = AREA_COLOR[area];
    return (
      <section
        key={area}
        aria-labelledby={`area-${area}`}
        className="flex flex-col gap-4 rounded-xl border bg-card p-4"
      >
        <header className="flex items-center gap-3">
          <Ring share={share} color={color} />
          <div>
            <h2 id={`area-${area}`} className="font-semibold">
              {t.areas[area]}
            </h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t.shippedOf(shippedAll.length, counted.length)}
            </p>
          </div>
        </header>

        <Group title={t.now} color={color}>
          {now.length ? <ul className="flex flex-col">{now.map(row)}</ul> : <Empty>{t.nothingNow}</Empty>}
        </Group>
        <Group title={t.next} color={color} dashed>
          {next.length ? <ul className="flex flex-col">{next.map(row)}</ul> : <Empty>{t.nothingNext}</Empty>}
        </Group>
        {shippedAll.length > 0 && (
          <Group title={t.statuses.shipped} color={color}>
            <ul className="flex flex-col">{shippedAll.map(row)}</ul>
          </Group>
        )}
        {onHold.length > 0 && (
          <Group title={t.onHold} color="var(--muted-foreground)" dashed>
            <ul className="flex flex-col opacity-80">{onHold.map(row)}</ul>
          </Group>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t.sort.label} className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(["votes", "newest"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => setSort(value)}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                sort === value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.sort[value]}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.voteFailed}
          </p>
        )}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">{areas.map(areaCard)}</div>
    </div>
  );
}

// The share of an area that has shipped, as a ring in the area's color.
function Ring({ share, color }: { share: number; color: string }) {
  const r = 18;
  const length = 2 * Math.PI * r;
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={22} cy={22} r={r} fill="none" stroke="var(--muted)" strokeWidth={5} />
      <circle
        cx={22}
        cy={22}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${share * length} ${length}`}
      />
    </svg>
  );
}

function Group({
  title,
  color,
  dashed,
  children,
}: {
  title: string;
  color: string;
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-1 border-l-2 pl-2"
      style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
    >
      <h3 className="px-2 text-xs font-medium tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-2 py-1 text-sm text-muted-foreground">{children}</p>;
}
