import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { getDictionary, getLocale } from "@/i18n/server";
import { linkhubStatus, type LinkAdapterStatus } from "@/lib/linkhub";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "LinkHub status" };

// The gateway's own status table (GET /admin/status), read with the admin key on the server:
// per platform, every parser's score, success rate, latency, breaker and last probe.
export default async function LinkHubStatusPage() {
  const t = (await getDictionary()).linkhub.status;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground">{t.description}</p>
      </div>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-muted/40" />}>
        <StatusBody />
      </Suspense>
    </div>
  );
}

async function StatusBody() {
  // Runtime settings and live data: never prerendered at build.
  await connection();
  const t = (await getDictionary()).linkhub;
  const lang = await getLocale();
  const s = t.status;
  let status;
  try {
    status = await linkhubStatus();
  } catch {
    return <p className="text-muted-foreground">{s.unavailable}</p>;
  }
  const when = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(lang === "zh" ? "zh-TW" : "en-US", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date(iso))
      : s.never;
  const platforms = Object.entries(status.platforms).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-muted-foreground">{s.generatedAt(when(status.generatedAt))}</p>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">{s.adapters}</h2>
        <div className="flex flex-wrap gap-2">
          {status.adapters.map((a) => (
            <Badge key={a.name} variant="outline" title={a.engine}>
              {a.name}
              <span className="ml-1 font-normal text-muted-foreground">{a.engine}</span>
              {a.supportsDownload && (
                <span className="ml-1 font-normal text-muted-foreground">· {s.supportsDownload}</span>
              )}
            </Badge>
          ))}
        </div>
      </section>
      {platforms.map(([platform, p]) => (
        <section key={platform} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold">{t.platformNames[platform] ?? platform}</h2>
            <span className={cn("text-xs", p.healthy > 0 ? "text-[#089981]" : "text-[#f23645]")}>
              {s.healthy(p.healthy, p.total)}
            </span>
            <span className="text-xs text-muted-foreground">{s.probes[p.probeLinks]}</span>
            {p.lastProbeRun && (
              <span className="text-xs text-muted-foreground">{s.lastProbeRun(when(p.lastProbeRun))}</span>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 font-medium">{s.columns.adapter}</th>
                  <th className="px-2 py-1.5 font-medium">{s.columns.engine}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{s.columns.score}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{s.columns.successRate}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{s.columns.latency}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{s.columns.window}</th>
                  <th className="px-2 py-1.5 font-medium">{s.columns.last}</th>
                  <th className="px-2 py-1.5 font-medium">{s.columns.breaker}</th>
                  <th className="px-2 py-1.5 font-medium">{s.columns.probe}</th>
                </tr>
              </thead>
              <tbody>
                {p.adapters.map((a: LinkAdapterStatus) => (
                  <tr key={a.adapter} className={cn("border-t", !a.healthy && "text-muted-foreground")}>
                    <td className="px-2 py-1.5 font-mono">{a.adapter}</td>
                    <td className="px-2 py-1.5">{a.engine}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.score.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {Math.round(a.successRate * 100)}%
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {a.p50LatencyMs ? `${(a.p50LatencyMs / 1000).toFixed(1)} s` : "–"}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{a.window}</td>
                    <td className="px-2 py-1.5">
                      {a.lastCode ? (
                        <span className={a.lastCode === "OK" ? "text-[#089981]" : "text-[#f23645]"}>
                          {a.lastCode}
                        </span>
                      ) : (
                        s.never
                      )}
                      {a.lastAt && <span className="ml-1 text-muted-foreground">{when(a.lastAt)}</span>}
                    </td>
                    <td className={cn("px-2 py-1.5", a.breaker.state === "open" && "text-[#f23645]")}>
                      {s.breakers[a.breaker.state] ?? a.breaker.state}
                      {a.breaker.state === "open" && a.breaker.openRemainingMs > 0 && (
                        <span className="ml-1 text-muted-foreground">
                          {Math.ceil(a.breaker.openRemainingMs / 60_000)} min
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {a.lastProbe ? (
                        <>
                          <span className={a.lastProbe.ok ? "text-[#089981]" : "text-[#f23645]"}>
                            {a.lastProbe.ok ? "OK" : (a.lastProbe.code ?? "FAIL")}
                          </span>
                          <span className="ml-1 text-muted-foreground">{when(a.lastProbe.at)}</span>
                        </>
                      ) : (
                        s.never
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
