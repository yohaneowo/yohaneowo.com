"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronUpIcon } from "lucide-react";
import { useLocale } from "@/i18n/locale-provider";
import { ROADMAP_AREAS, type RoadmapArea, type RoadmapStatus } from "@/lib/roadmap";
import { cn } from "@/lib/utils";
import { voteForItem } from "./actions";

export type BoardItem = {
  id: string;
  status: RoadmapStatus;
  area: RoadmapArea;
  title: string;
  detail: string;
  added: string;
  shipped: string | null;
};

type Sort = "votes" | "newest";

// Each area's branch color (lines and nodes only; text stays in the text colors).
const AREA_COLOR: Record<RoadmapArea, string> = {
  moviehub: "#d4a72c",
  bot: "#6b7cff",
  site: "#2fb388",
  coinhub: "#e8793a",
  uidhub: "#d65fa0",
};
const TRUNK = "var(--border)";
// The graph gutter: the trunk, then one lane per area that has items (narrower on phones).
const LANE = 22;
const NARROW_LANE = 13;
const NARROW = "(max-width: 640px)";

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const NODE_Y = 26;

type Row =
  | { kind: "item"; item: BoardItem; future: boolean }
  | { kind: "divider"; label: string; future: boolean; now?: boolean };

// The roadmap as a branch timeline, newest at the top: 考虑中 (dashed, the future), a 现在 line,
// 开发中, then 已上线 by date. A grey trunk runs down the left; each area is a colored branch
// that leaves the trunk at its oldest item. Votes change optimistically and settle on the
// server's count.
export function RoadmapBoard({
  items,
  counts,
  mine,
  signedIn,
}: {
  items: BoardItem[];
  counts: Record<string, number>;
  mine: string[];
  signedIn: boolean;
}) {
  const { t: dict, href } = useLocale();
  const t = dict.roadmap;
  const [sort, setSort] = useState<Sort>("votes");
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
  // so the browser can't jump there by itself. Scroll to it and mark it.
  useEffect(() => {
    function reveal() {
      const card = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!card?.id.startsWith("item-")) return;
      document.querySelectorAll("[data-linked]").forEach((el) => el.removeAttribute("data-linked"));
      card.setAttribute("data-linked", "");
      card.scrollIntoView({ block: "center" });
    }
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);

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

  const considering = items
    .filter((item) => item.status === "considering")
    .sort((a, b) =>
      sort === "votes"
        ? (votes[b.id] ?? 0) - (votes[a.id] ?? 0) || b.added.localeCompare(a.added)
        : b.added.localeCompare(a.added),
    );
  const building = items
    .filter((item) => item.status === "building")
    .sort((a, b) => b.added.localeCompare(a.added));
  const shipped = items
    .filter((item) => item.status === "shipped")
    .sort((a, b) => (b.shipped ?? "").localeCompare(a.shipped ?? ""));
  const rows: Row[] = [
    { kind: "divider", label: t.statuses.considering, future: true },
    ...considering.map((item) => ({ kind: "item" as const, item, future: true })),
    { kind: "divider", label: t.now, future: false, now: true },
    ...building.map((item) => ({ kind: "item" as const, item, future: false })),
    { kind: "divider", label: t.statuses.shipped, future: false },
    ...shipped.map((item) => ({ kind: "item" as const, item, future: false })),
  ];

  // Lanes: the areas that have items. Each runs from its first row to its last item, where it
  // leaves the trunk.
  const lanes = ROADMAP_AREAS.filter((area) => items.some((item) => item.area === area));
  const span = new Map(
    lanes.map((area) => {
      const at = rows.flatMap((row, i) => (row.kind === "item" && row.item.area === area ? [i] : []));
      return [area, { last: Math.max(...at) }];
    }),
  );
  const gutter = (lanes.length + 1) * lane;
  const x = (index: number) => lane / 2 + index * lane;

  // The lines through one row: the trunk, each lane that is open here (dashed in the future),
  // and the curve where a lane leaves the trunk at its last row.
  function graph(row: Row, index: number) {
    const dash = row.future ? "4 4" : undefined;
    return (
      <svg width={gutter} className="absolute inset-y-0 left-0 h-full overflow-visible" aria-hidden>
        <line x1={x(0)} x2={x(0)} y1="0" y2="100%" stroke={TRUNK} strokeWidth={2} strokeDasharray={dash} />
        {lanes.map((area, i) => {
          const { last } = span.get(area)!;
          if (index > last) return null;
          const color = AREA_COLOR[area];
          const cx = x(i + 1);
          const isNode = row.kind === "item" && row.item.area === area;
          return (
            <Fragment key={area}>
              {/* Above the node (or the whole row when the lane only passes through). */}
              <line
                x1={cx}
                x2={cx}
                y1="0"
                y2={index === last ? NODE_Y : "100%"}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dash}
                opacity={0.85}
              />
              {index === last && (
                // Where the branch left the trunk.
                <path
                  d={`M ${cx} ${NODE_Y} C ${cx} ${NODE_Y + 26}, ${x(0)} ${NODE_Y + 18}, ${x(0)} ${NODE_Y + 44}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.85}
                />
              )}
              {isNode && <Node status={(row as { item: BoardItem }).item.status} cx={cx} color={color} />}
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
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {lanes.map((area) => (
            <li key={area} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: AREA_COLOR[area] }} aria-hidden />
              {t.areas[area]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <Legend status="shipped" />
            {t.statuses.shipped}
          </li>
          <li className="flex items-center gap-1.5">
            <Legend status="building" />
            {t.statuses.building}
          </li>
          <li className="flex items-center gap-1.5">
            <Legend status="considering" />
            {t.statuses.considering}
          </li>
        </ul>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t.voteFailed}
        </p>
      )}

      <ol className="flex flex-col">
        {rows.map((row, index) => {
          if (row.kind === "divider")
            return (
              <li key={`d-${row.label}`} className="relative" style={{ paddingLeft: gutter + 12 }}>
                {graph(row, index)}
                <div className={cn("flex items-center gap-3 pt-3 pb-2", row.now && "py-4")}>
                  <h2 className={cn("text-sm font-medium", !row.now && "text-muted-foreground")}>
                    {row.label}
                  </h2>
                  {row.now && <span className="h-px flex-1 border-t border-dashed" aria-hidden />}
                </div>
              </li>
            );
          const { item } = row;
          const count = votes[item.id] ?? 0;
          const isMine = voted.has(item.id);
          return (
            <li key={item.id} className="relative pb-3" style={{ paddingLeft: gutter + 12 }}>
              {graph(row, index)}
              <article
                id={`item-${item.id}`}
                className={cn(
                  "flex scroll-mt-32 items-start gap-3 rounded-xl border bg-card px-4 py-3 data-[linked]:ring-2 data-[linked]:ring-primary/60",
                  item.status === "considering" && "border-dashed",
                )}
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h3 className="leading-snug font-medium">{item.title}</h3>
                    <span className="text-xs text-muted-foreground">
                      {t.areas[item.area]}
                      {item.shipped && ` · ${item.shipped}`}
                      {item.status === "building" && ` · ${t.statuses.building}`}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                {item.status === "shipped" ? (
                  count > 0 && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {t.votes(count)}
                    </span>
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
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ● shipped, ◉ in progress (pulsing), ○ considering.
function Node({ status, cx, color }: { status: RoadmapStatus; cx: number; color: string }) {
  if (status === "shipped")
    return <circle cx={cx} cy={NODE_Y} r={6} fill={color} stroke="var(--background)" strokeWidth={2} />;
  if (status === "building")
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

function Legend({ status }: { status: RoadmapStatus }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
      {status === "shipped" && <circle cx={8} cy={8} r={5} fill="var(--muted-foreground)" />}
      {status === "building" && (
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
