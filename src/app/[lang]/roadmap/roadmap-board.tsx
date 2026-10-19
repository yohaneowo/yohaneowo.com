"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { ROADMAP_AREAS, VOTABLE, type RoadmapArea, type RoadmapStatus } from "@/lib/roadmap";
import { cn } from "@/lib/utils";
import { voteForItem } from "./actions";
import { AreaFilter, ItemDetails } from "./item-parts";
import { AREA_COLOR, type ViewItem } from "./roadmap-view";

type Sort = "votes" | "newest";

const TRUNK = "var(--border)";
// The graph gutter: the trunk, then one lane per area that has items (narrower on phones).
const LANE = 22;
const NARROW_LANE = 13;
const NODE_Y = 26;
const NARROW = "(max-width: 640px)";
const RECENT = 3;

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type Row =
  | { kind: "item"; item: ViewItem; future: boolean }
  | { kind: "divider"; key: string; label: string; future: boolean; now?: boolean };

// The roadmap as a branch timeline, newest at the top: 考虑中 (dashed, the future), a 现在 line,
// 开发中, 测试中, then the last few 已上线 (the rest are in the changelog). A grey trunk runs down
// the left; each area is a colored branch leaving the trunk at its oldest item shown. Paused and
// declined items sit below the timeline. Votes change optimistically and settle on the server's
// count.
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
  const [area, setArea] = useState<RoadmapArea | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [votes, setVotes] = useState(counts);
  const [voted, setVoted] = useState(() => new Set(mine));
  const [error, setError] = useState(false);
  const [, startTransition] = useTransition();
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
  const lane = narrow ? NARROW_LANE : LANE;

  // A link to one item (#item-…, e.g. from a planned page): the items stream in after the page,
  // so the browser can't jump there by itself. Open it, scroll to it and mark it.
  useEffect(() => {
    function reveal() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("item-")) return;
      setOpen((current) => new Set(current).add(id.slice(5)));
      requestAnimationFrame(() => {
        const card = document.getElementById(id);
        if (!card) return;
        document.querySelectorAll("[data-linked]").forEach((el) => el.removeAttribute("data-linked"));
        card.setAttribute("data-linked", "");
        card.scrollIntoView({ block: "center" });
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
    const next = new Set(voted);
    if (had) next.delete(id);
    else next.add(id);
    setVoted(next);
    setVotes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? -1 : 1)) }));
    setError(false);
    startTransition(async () => {
      const result = await voteForItem(id);
      if ("error" in result) {
        // Put it back as it was.
        setVoted((current) => {
          const back = new Set(current);
          if (had) back.add(id);
          else back.delete(id);
          return back;
        });
        setVotes((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + (had ? 1 : -1)) }));
        setError(true);
        return;
      }
      setVotes((current) => ({ ...current, [id]: result.votes }));
    });
  }

  const shown = items.filter((item) => area === null || item.area === area);
  const by = (status: RoadmapStatus) => shown.filter((item) => item.status === status);
  const considering = by("considering").sort((a, b) =>
    sort === "votes"
      ? (votes[b.id] ?? 0) - (votes[a.id] ?? 0) || b.added.localeCompare(a.added)
      : b.added.localeCompare(a.added),
  );
  const newest = (a: ViewItem, b: ViewItem) => (b.started ?? b.added).localeCompare(a.started ?? a.added);
  const building = by("building").sort(newest);
  const testing = by("testing").sort(newest);
  const shipped = by("shipped")
    .sort((a, b) => (b.shipped ?? "").localeCompare(a.shipped ?? ""))
    .slice(0, RECENT);
  const onHold = [...by("paused"), ...by("declined")];
  const asRows = (list: ViewItem[], future = false) =>
    list.map((item) => ({ kind: "item" as const, item, future }));
  const rows: Row[] = [
    { kind: "divider", key: "considering", label: t.statuses.considering, future: true },
    ...asRows(considering, true),
    { kind: "divider", key: "now", label: t.now, future: false, now: true },
    ...(building.length
      ? [{ kind: "divider" as const, key: "building", label: t.statuses.building, future: false }]
      : []),
    ...asRows(building),
    ...(testing.length
      ? [{ kind: "divider" as const, key: "testing", label: t.statuses.testing, future: false }]
      : []),
    ...asRows(testing),
    { kind: "divider", key: "shipped", label: t.recent, future: false },
    ...asRows(shipped),
  ];

  // Lanes: the areas with items on the timeline, each running down to its last one.
  const lanes = ROADMAP_AREAS.filter((a) => rows.some((row) => row.kind === "item" && row.item.area === a));
  const last = new Map(
    lanes.map((a) => [
      a,
      Math.max(...rows.flatMap((row, i) => (row.kind === "item" && row.item.area === a ? [i] : []))),
    ]),
  );
  const gutter = (lanes.length + 1) * lane;
  const x = (index: number) => lane / 2 + index * lane;

  // The lines through one row: the trunk, each lane still open here (dashed in the future), and
  // the curve where a lane leaves the trunk at its last row.
  function graph(row: Row, index: number) {
    const dash = row.future ? "4 4" : undefined;
    return (
      <svg width={gutter} className="absolute inset-y-0 left-0 h-full overflow-visible" aria-hidden>
        <line x1={x(0)} x2={x(0)} y1="0" y2="100%" stroke={TRUNK} strokeWidth={2} strokeDasharray={dash} />
        {lanes.map((a, i) => {
          const end = last.get(a)!;
          if (index > end) return null;
          const color = AREA_COLOR[a];
          const cx = x(i + 1);
          return (
            <Fragment key={a}>
              <line
                x1={cx}
                x2={cx}
                y1="0"
                y2={index === end ? NODE_Y : "100%"}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dash}
                opacity={0.85}
              />
              {index === end && (
                <path
                  d={`M ${cx} ${NODE_Y} C ${cx} ${NODE_Y + 26}, ${x(0)} ${NODE_Y + 18}, ${x(0)} ${NODE_Y + 44}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.85}
                />
              )}
              {row.kind === "item" && row.item.area === a && (
                <Node status={row.item.status} cx={cx} color={color} />
              )}
            </Fragment>
          );
        })}
        {row.kind === "divider" && (
          <circle
            cx={x(0)}
            cy={NODE_Y - 6}
            r={row.now ? 5 : 3.5}
            fill={row.now ? "var(--foreground)" : TRUNK}
          />
        )}
      </svg>
    );
  }

  function card(item: ViewItem) {
    const count = votes[item.id] ?? 0;
    const isMine = voted.has(item.id);
    const isOpen = open.has(item.id);
    const done = item.steps.filter((s) => s.done).length;
    const hasDetails = Boolean(
      item.why || item.steps.length || item.notes.length || item.links.length || item.reason,
    );
    return (
      <article
        id={`item-${item.id}`}
        className={cn(
          "flex scroll-mt-32 flex-col rounded-xl border bg-card px-4 py-3 data-linked:ring-2 data-linked:ring-primary/60",
          (item.status === "considering" || item.status === "paused") && "border-dashed",
          item.status === "declined" && "opacity-70",
        )}
      >
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h3 className="leading-snug font-medium">{item.title}</h3>
              <span className="text-xs text-muted-foreground">
                {t.areas[item.area]}
                {item.status !== "considering" && ` · ${t.statuses[item.status]}`}
                {item.shipped && ` · ${item.shipped}`}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{item.summary}</p>
            {(item.steps.length > 0 || hasDetails) && (
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                {item.steps.length > 0 && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-muted">
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
                {hasDetails && (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleOpen(item.id)}
                    className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                  >
                    {isOpen ? t.details.close : t.details.open}
                    <ChevronDownIcon
                      className={cn("size-3.5 transition-transform", isOpen && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                )}
              </div>
            )}
          </div>
          {!VOTABLE.includes(item.status) ? (
            count > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t.votes(count)}</span>
            )
          ) : signedIn ? (
            <button
              type="button"
              onClick={() => vote(item.id)}
              aria-pressed={isMine}
              aria-label={`${isMine ? t.voted : t.vote}: ${item.title}`}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1 text-xs transition-colors",
                isMine
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              <ChevronUpIcon className="size-4" aria-hidden />
              <span className="tabular-nums">{count}</span>
            </button>
          ) : (
            <Link
              href={href("/login?next=/roadmap")}
              title={t.voteHint}
              aria-label={`${t.voteHint}: ${item.title}`}
              className="flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronUpIcon className="size-4" aria-hidden />
              <span className="tabular-nums">{count}</span>
            </Link>
          )}
        </div>
        {isOpen && <ItemDetails item={item} />}
      </article>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <AreaFilter areas={items.map((item) => item.area)} value={area} onChange={setArea} />
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
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {(["shipped", "testing", "considering"] as const).map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <Legend status={status} />
                {t.statuses[status]}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t.voteFailed}
        </p>
      )}

      <ol className="flex flex-col">
        {rows.map((row, index) =>
          row.kind === "divider" ? (
            <li key={`d-${row.key}`} className="relative" style={{ paddingLeft: gutter + 12 }}>
              {graph(row, index)}
              <div className={cn("flex items-center gap-3 pt-3 pb-2", row.now && "py-4")}>
                <h2 className={cn("text-sm font-medium", !row.now && "text-muted-foreground")}>
                  {row.label}
                </h2>
                {row.now && <span className="h-px flex-1 border-t border-dashed" aria-hidden />}
              </div>
              {row.key === "considering" && considering.length === 0 && (
                <p className="pb-3 text-sm text-muted-foreground">{t.empty}</p>
              )}
            </li>
          ) : (
            <li key={row.item.id} className="relative pb-3" style={{ paddingLeft: gutter + 12 }}>
              {graph(row, index)}
              {card(row.item)}
            </li>
          ),
        )}
        <li style={{ paddingLeft: gutter + 12 }}>
          <Link href={href("/roadmap/changelog")} className="text-sm underline underline-offset-2">
            {t.allChangelog}
          </Link>
        </li>
      </ol>

      {onHold.length > 0 && (
        <section className="mt-6 flex flex-col gap-3">
          <h2 className="font-medium">{t.onHold}</h2>
          {onHold.map((item) => (
            <Fragment key={item.id}>{card(item)}</Fragment>
          ))}
        </section>
      )}
    </div>
  );
}

// ● shipped, ◉ in progress or testing (pulsing), ○ considering.
function Node({ status, cx, color }: { status: RoadmapStatus; cx: number; color: string }) {
  if (status === "shipped")
    return <circle cx={cx} cy={NODE_Y} r={6} fill={color} stroke="var(--background)" strokeWidth={2} />;
  if (status === "building" || status === "testing")
    return (
      <g>
        <circle cx={cx} cy={NODE_Y} r={9} fill={color} opacity={0.25} className="motion-safe:animate-pulse" />
        <circle cx={cx} cy={NODE_Y} r={6} fill="var(--background)" stroke={color} strokeWidth={2.5} />
        <circle cx={cx} cy={NODE_Y} r={2.5} fill={color} />
      </g>
    );
  return (
    <circle
      cx={cx}
      cy={NODE_Y}
      r={6}
      fill="var(--background)"
      stroke={color}
      strokeWidth={2}
      strokeDasharray="3 2"
    />
  );
}

function Legend({ status }: { status: "shipped" | "testing" | "considering" }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      {status === "shipped" && <circle cx={8} cy={8} r={5} fill="var(--muted-foreground)" />}
      {status === "testing" && (
        <>
          <circle cx={8} cy={8} r={5} fill="none" stroke="var(--muted-foreground)" strokeWidth={2} />
          <circle cx={8} cy={8} r={2} fill="var(--muted-foreground)" />
        </>
      )}
      {status === "considering" && (
        <circle
          cx={8}
          cy={8}
          r={5}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          strokeDasharray="3 2"
        />
      )}
    </svg>
  );
}
