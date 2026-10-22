"use client";

import { useEffect, useMemo, useState } from "react";
import { PlusIcon, SearchIcon, StarIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/i18n/locale-provider";
import { resolveSymbol } from "@/lib/coinhub/datafeed";
import { fmtNumber } from "@/lib/coinhub/format";
import { INDICATORS, INDICATOR_MAP, type IndicatorCategory } from "@/lib/coinhub/indicators";
import { parseInterval, supportsInterval } from "@/lib/coinhub/intervals";
import { DEFAULT_LEVELS } from "@/lib/coinhub/overlays/fib-gann";
import { ext as overlayExt, look, type Level } from "@/lib/coinhub/overlays/utils";
import {
  DEFAULT_SETTINGS,
  getState,
  indicatorConfig,
  newId,
  setChartInterval,
  setState,
  updateChart,
  useTerminal,
  type AlertCondition,
  type ChartSettings,
} from "@/lib/coinhub/store";
import type { CoinSymbol } from "@/lib/coinhub/types";
import { TIMEZONES } from "./bottom-bar";
import { ColorGrid } from "./selection-toolbar";
import { LEVEL_TOOLS, TEXT_TOOLS, TOOL_OPTIONS } from "./tool-catalog";
import { closeDialog, registry, useUi, type Dialog as DialogState } from "./ui-store";

function useDialog<T extends DialogState["type"]>(type: T) {
  const dialog = useUi((s) => s.dialog);
  return dialog?.type === type ? (dialog as Extract<DialogState, { type: T }>) : null;
}

function ColorButton({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        className="flex h-8 items-center gap-2 rounded-md border px-2 text-xs hover:bg-muted"
        aria-label={label}
      >
        <span className="size-4 rounded-sm border" style={{ background: value }} />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <ColorGrid value={value} onChange={onChange} />
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Indicators

function IndicatorsBody() {
  const { t } = useLocale();
  const d = t.coinhub.indicators;
  const active = useTerminal((s) => s.active);
  const favorites = useTerminal((s) => s.favorites.indicators);
  const added = useTerminal((s) => s.charts[s.active].indicators);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "favorites" | "templates" | IndicatorCategory>("all");
  const templates = useTerminal((s) => s.indicatorTemplates);
  const [templateName, setTemplateName] = useState("");
  const q = query.trim().toLowerCase();
  // Custom indicators override built-ins with the same name.
  const catalog = useMemo(
    () => INDICATORS.filter((m, i) => INDICATORS.findLastIndex((x) => x.name === m.name) === i),
    [],
  );
  const list = catalog.filter(
    (m) =>
      (tab === "all" || (tab === "favorites" ? favorites.includes(m.name) : m.category === tab)) &&
      (!q || m.title.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
  );
  const tabs: Array<[typeof tab, string]> = [
    ["all", d.all],
    ["favorites", d.favorites],
    ["templates", d.templates],
    ...(["trend", "oscillator", "volatility", "volume", "crypto"] as const).map(
      (c) => [c, d.categories[c]] as [typeof tab, string],
    ),
  ];
  return (
    <DialogContent className="flex h-[min(620px,85vh)] flex-col gap-0 p-0 sm:max-w-2xl">
      <DialogHeader className="border-b px-4 pt-4 pb-3">
        <DialogTitle>{d.title}</DialogTitle>
        <DialogDescription className="sr-only">{d.search}</DialogDescription>
        <div className="mt-2 flex items-center gap-2 rounded-lg border px-3">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={d.search}
            className="h-9 flex-1 bg-transparent outline-none"
          />
        </div>
      </DialogHeader>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(
                "shrink-0 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                tab === key && "bg-muted font-medium",
              )}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "templates" ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const name = templateName.trim();
                if (!name || added.length === 0) return;
                setState((s) => ({
                  indicatorTemplates: [
                    ...s.indicatorTemplates.filter((x) => x.name !== name),
                    { name, indicators: added },
                  ],
                }));
                setTemplateName("");
              }}
            >
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={d.templateName}
              />
              <Button type="submit" disabled={!templateName.trim() || added.length === 0}>
                {d.saveTemplate}
              </Button>
            </form>
            {templates.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">{d.noTemplates}</p>
            )}
            {templates.map((tpl) => (
              <div key={tpl.name} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{tpl.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {tpl.indicators.map((i) => i.name).join(" · ")}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    updateChart(active, {
                      indicators: tpl.indicators.map((i) => ({
                        ...indicatorConfig(i.name, i.calcParams),
                        colors: i.colors,
                        widths: i.widths,
                      })),
                    })
                  }
                >
                  {d.applyTemplate}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setState((s) => ({
                      indicatorTemplates: s.indicatorTemplates.filter((x) => x.name !== tpl.name),
                    }))
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {list.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">{d.noResults}</p>
            )}
            {list.map((m) => {
              const count = added.filter((a) => a.name === m.name).length;
              const fav = favorites.includes(m.name);
              return (
                <div key={m.name} className="group/ind flex items-center gap-2 px-3 hover:bg-muted">
                  <button
                    type="button"
                    className={cn(
                      "rounded p-1",
                      fav ? "text-amber-500" : "text-muted-foreground opacity-0 group-hover/ind:opacity-100",
                    )}
                    onClick={() =>
                      setState((s) => ({
                        favorites: {
                          ...s.favorites,
                          indicators: fav
                            ? s.favorites.indicators.filter((n) => n !== m.name)
                            : [...s.favorites.indicators, m.name],
                        },
                      }))
                    }
                    aria-label={d.favorites}
                  >
                    <StarIcon className={cn("size-3.5", fav && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 py-2 text-left text-sm"
                    onClick={() =>
                      updateChart(active, (c) => ({ indicators: [...c.indicators, indicatorConfig(m.name)] }))
                    }
                  >
                    <span className="flex-1">
                      {m.title}
                      {m.title !== m.name && (
                        <span className="ml-2 text-xs text-muted-foreground">{m.name}</span>
                      )}
                    </span>
                    {count > 0 && (
                      <span className="rounded bg-primary/10 px-1.5 text-xs text-primary">
                        {d.added} {count}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{d.categories[m.category]}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DialogContent>
  );
}

export function IndicatorsDialog() {
  const dialog = useDialog("indicators");
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
      {dialog && <IndicatorsBody />}
    </Dialog>
  );
}

function IndicatorSettingsBody({ chart, id }: { chart: number; id: string }) {
  const { t } = useLocale();
  const d = t.coinhub.indicators;
  const config = useTerminal((s) => s.charts[chart]?.indicators.find((i) => i.id === id));
  const controller = registry.get(chart);
  const indicator = controller?.chart.getIndicators({ id })[0];
  const meta = config ? INDICATOR_MAP[config.name] : undefined;
  const [params, setParams] = useState<number[]>(config?.calcParams ?? []);
  const figures = indicator?.figures.filter((f) => f.type === "line") ?? [];
  const palette = ["#2962ff", "#ff6d00", "#e91e63", "#00bcd4", "#9c27b0", "#4caf50"];
  const [colors, setColors] = useState<string[]>(() =>
    figures.map((_, i) => config?.colors?.[i] ?? palette[i % palette.length]),
  );
  const [widths, setWidths] = useState<number[]>(() => figures.map((_, i) => config?.widths?.[i] ?? 1));
  if (!config) return null;
  const variable = ["MA", "EMA", "VOL", "BIAS"].includes(config.name);
  const apply = () => {
    updateChart(chart, (c) => ({
      indicators: c.indicators.map((i) =>
        i.id === id ? { ...i, calcParams: params.filter((v) => Number.isFinite(v)), colors, widths } : i,
      ),
    }));
    closeDialog();
  };
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{d.settingsTitle(meta?.title ?? config.name)}</DialogTitle>
        <DialogDescription className="sr-only">{meta?.title}</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="inputs">
        <TabsList>
          <TabsTrigger value="inputs">{t.coinhub.drawing.inputs}</TabsTrigger>
          <TabsTrigger value="style">{t.coinhub.drawing.style}</TabsTrigger>
        </TabsList>
        <TabsContent value="inputs" className="space-y-2 pt-2">
          {params.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          {params.map((value, i) => (
            <Row key={i} label={meta?.params[i] ?? `#${i + 1}`}>
              <Input
                type="number"
                className="w-28"
                value={Number.isFinite(value) ? value : ""}
                step="any"
                onChange={(e) => setParams((p) => p.map((v, j) => (j === i ? Number(e.target.value) : v)))}
              />
              {variable && params.length > 1 && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setParams((p) => p.filter((_, j) => j !== i))}
                >
                  <Trash2Icon />
                </Button>
              )}
            </Row>
          ))}
          {variable && params.length < 6 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setParams((p) => [...p, (p[p.length - 1] ?? 10) * 2])}
            >
              <PlusIcon />
            </Button>
          )}
        </TabsContent>
        <TabsContent value="style" className="space-y-2 pt-2">
          {figures.map((f, i) => (
            <Row key={f.key} label={f.title?.replace(/:\s*$/, "") || d.color(i)}>
              <ColorButton
                value={colors[i]}
                onChange={(color) => setColors((c) => c.map((x, j) => (j === i ? color : x)))}
              />
              <div className="flex">
                {[1, 2, 3].map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted",
                      widths[i] === w && "bg-muted",
                    )}
                    onClick={() => setWidths((ws) => ws.map((x, j) => (j === i ? w : x)))}
                  >
                    <span className="w-4 rounded-full bg-current" style={{ height: w }} />
                  </button>
                ))}
              </div>
            </Row>
          ))}
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button variant="ghost" onClick={() => setParams(meta?.defaults ?? [])}>
          {d.defaults}
        </Button>
        <Button onClick={apply}>{t.coinhub.drawing.apply}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function IndicatorSettingsDialog() {
  const dialog = useDialog("indicatorSettings");
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
      {dialog && <IndicatorSettingsBody key={dialog.id} chart={dialog.chart} id={dialog.id} />}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Chart settings

function SettingsBody() {
  const { t } = useLocale();
  const s = t.coinhub.settings;
  const settings = useTerminal((st) => st.settings);
  const set = (patch: Partial<ChartSettings>) =>
    setState((st) => ({ settings: { ...st.settings, ...patch } }));
  const toggle = (key: keyof ChartSettings, label: string) => (
    <Row label={label}>
      <Switch
        checked={Boolean(settings[key])}
        onCheckedChange={(v) => set({ [key]: v } as Partial<ChartSettings>)}
      />
    </Row>
  );
  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{s.title}</DialogTitle>
        <DialogDescription className="sr-only">{s.title}</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="symbol">
        <TabsList className="w-full">
          <TabsTrigger value="symbol">{s.symbol}</TabsTrigger>
          <TabsTrigger value="status">{s.status}</TabsTrigger>
          <TabsTrigger value="scales">{s.scales}</TabsTrigger>
          <TabsTrigger value="appearance">{s.appearance}</TabsTrigger>
        </TabsList>
        <TabsContent value="symbol" className="space-y-1 pt-2">
          <Row label={s.upColor}>
            <ColorButton value={settings.upColor} onChange={(upColor) => set({ upColor })} />
          </Row>
          <Row label={s.downColor}>
            <ColorButton value={settings.downColor} onChange={(downColor) => set({ downColor })} />
          </Row>
          {toggle("bodyUp", `${s.body} ↑`)}
          {toggle("bodyDown", `${s.body} ↓`)}
          {toggle("borders", s.borders)}
          {toggle("wicks", s.wicks)}
        </TabsContent>
        <TabsContent value="status" className="space-y-1 pt-2">
          {toggle("showLegendValues", s.legendValues)}
          {toggle("showIndicatorValues", s.indicatorValues)}
          {toggle("watermark", s.watermark)}
        </TabsContent>
        <TabsContent value="scales" className="space-y-1 pt-2">
          {toggle("showLastPrice", s.lastPrice)}
          {toggle("showHighLow", s.highLow)}
          {toggle("countdown", s.countdown)}
          {toggle("axisWheelTradingView", s.axisWheel)}
          {toggle("showHoldingLines", s.holdingLines)}
          <Row label={s.timezone}>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={settings.timezone}
              onChange={(e) => set({ timezone: e.target.value })}
            >
              {TIMEZONES.map((z) => (
                <option key={z} value={z}>
                  {z === "browser" ? t.coinhub.bottom.browserTime : z}
                </option>
              ))}
            </select>
          </Row>
        </TabsContent>
        <TabsContent value="appearance" className="space-y-1 pt-2">
          <Row label={s.grid}>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={settings.grid}
              onChange={(e) => set({ grid: e.target.value as ChartSettings["grid"] })}
            >
              <option value="both">{s.gridBoth}</option>
              <option value="vertical">{s.gridVertical}</option>
              <option value="horizontal">{s.gridHorizontal}</option>
              <option value="none">{s.gridNone}</option>
            </select>
          </Row>
          <Row label={s.crosshair}>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={settings.crosshairStyle}
              onChange={(e) => set({ crosshairStyle: e.target.value as ChartSettings["crosshairStyle"] })}
            >
              <option value="dashed">- - -</option>
              <option value="dotted">· · ·</option>
              <option value="solid">———</option>
            </select>
          </Row>
          <Row label={s.rightOffset}>
            <Input
              type="number"
              className="w-24"
              value={settings.rightOffset}
              min={0}
              max={400}
              onChange={(e) => set({ rightOffset: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Row>
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button
          variant="ghost"
          onClick={() => setState({ settings: { ...DEFAULT_SETTINGS, timezone: settings.timezone } })}
        >
          {s.reset}
        </Button>
        <Button onClick={closeDialog}>{s.close}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function SettingsDialog() {
  const dialog = useDialog("settings");
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
      {dialog && <SettingsBody />}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Alerts

function AlertBody({ dialog }: { dialog: Extract<DialogState, { type: "alert" }> }) {
  const { t } = useLocale();
  const a = t.coinhub.alerts;
  const existing = dialog.alert;
  const line = existing?.line ?? dialog.line;
  const symbolId = existing?.symbolId ?? dialog.symbolId ?? getState().charts[getState().active].symbolId;
  const [symbol, setSymbol] = useState<CoinSymbol | null>(null);
  const [condition, setCondition] = useState<AlertCondition>(existing?.condition ?? "crossing");
  const [price, setPrice] = useState(String(existing?.price ?? dialog.price ?? ""));
  const [message, setMessage] = useState(existing?.message ?? "");
  const [trigger, setTrigger] = useState<"once" | "every">(existing?.trigger ?? "once");
  useEffect(() => {
    let cancelled = false;
    resolveSymbol(symbolId).then((s) => {
      if (cancelled || !s) return;
      setSymbol(s);
      setPrice((p) => (p && !existing ? fmtNumber(Number(p), s.pricePrecision).replace(/,/g, "") : p));
    });
    return () => {
      cancelled = true;
    };
  }, [symbolId, existing]);
  const save = () => {
    const value = Number(price);
    if (!symbol || !Number.isFinite(value)) return;
    const display = symbol.display;
    const text = message.trim() || a.defaultMessage(display, a.conditions[condition], price);
    setState((s) => ({
      alerts: existing
        ? s.alerts.map((x) =>
            x.id === existing.id
              ? { ...x, condition, price: value, message: text, trigger, active: true }
              : x,
          )
        : [
            ...s.alerts,
            {
              id: newId(),
              symbolId,
              display,
              condition,
              price: value,
              line,
              message: text,
              trigger,
              active: true,
              createdAt: Date.now(),
            },
          ],
    }));
    if (typeof Notification !== "undefined" && Notification.permission === "default")
      void Notification.requestPermission();
    closeDialog();
  };
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {existing ? a.edit : a.create} · {symbol?.display ?? symbolId}
        </DialogTitle>
        <DialogDescription>{a.hint}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>{a.condition}</Label>
          <select
            className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            value={condition}
            onChange={(e) => setCondition(e.target.value as AlertCondition)}
          >
            {(Object.keys(a.conditions) as AlertCondition[]).map((c) => (
              <option key={c} value={c}>
                {a.conditions[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label>{a.price}</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" autoFocus />
        </div>
        <div className="space-y-1">
          <Label>{a.trigger}</Label>
          <div className="flex gap-2">
            {(["once", "every"] as const).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={trigger === k ? "secondary" : "ghost"}
                onClick={() => setTrigger(k)}
              >
                {a[k]}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <Label>{a.message}</Label>
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={a.defaultMessage(symbol?.display ?? "", a.conditions[condition], price)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={closeDialog}>
          {a.cancel}
        </Button>
        <Button onClick={save}>{existing ? a.update : a.save}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function AlertDialog() {
  const dialog = useDialog("alert");
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
      {dialog && <AlertBody dialog={dialog} />}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Go to date

function GoToBody() {
  const { t } = useLocale();
  const b = t.coinhub.bottom;
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const [date, setDate] = useState(
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
  );
  const [time, setTime] = useState("00:00");
  const go = () => {
    const ts = new Date(`${date}T${time || "00:00"}`).getTime();
    if (Number.isFinite(ts)) registry.get(getState().active)?.goToDate(ts);
    closeDialog();
  };
  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{b.goToTitle}</DialogTitle>
        <DialogDescription className="sr-only">{b.goTo}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>{b.date}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{b.time}</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={go}>{b.go}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function GoToDialog() {
  const dialog = useDialog("goto");
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
      {dialog && <GoToBody />}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Interval typed on the chart ("5", "4h", "1D")

function IntervalBody({ text }: { text: string }) {
  const { t } = useLocale();
  const [value, setValue] = useState(text);
  const parsed = parseInterval(value);
  const apply = () => {
    const s = getState();
    if (parsed) {
      void resolveSymbol(s.charts[s.active].symbolId).then((symbol) => {
        if (supportsInterval(symbol, parsed)) setChartInterval(s.active, parsed);
      });
    }
    closeDialog();
  };
  return (
    <DialogContent className="top-1/3 sm:max-w-xs" showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>{t.coinhub.toolbar.interval}</DialogTitle>
        <DialogDescription>{t.coinhub.toolbar.customInterval}</DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        className={cn("text-lg", !parsed && value && "text-destructive")}
      />
      <p className="text-sm text-muted-foreground">{parsed ?? "—"}</p>
    </DialogContent>
  );
}

export function IntervalDialog() {
  const dialog = useDialog("interval");
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
      {dialog && <IntervalBody text={dialog.text} />}
    </Dialog>
  );
}

// ---------------------------------------------------------------------------------------------
// Drawing settings

function DrawingSettingsBody({ chart, id }: { chart: number; id: string }) {
  const { t } = useLocale();
  const d = t.coinhub.drawing;
  const controller = registry.get(chart);
  const [overlay, setOverlay] = useState(() => controller?.chart.getOverlays({ id })[0] ?? null);
  useEffect(() => {
    if (!controller) return;
    return controller.on("drawings", () => setOverlay(controller.chart.getOverlays({ id })[0] ?? null));
  }, [controller, id]);
  if (!controller || !overlay) return null;
  const l = look(overlay);
  const options = TOOL_OPTIONS[overlay.name] ?? [];
  const data = overlayExt(overlay, {} as Record<string, unknown>);
  const levels = (data.levels as Level[] | undefined) ?? DEFAULT_LEVELS[overlay.name] ?? null;
  const update = (patch: Parameters<typeof controller.updateDrawing>[1]) =>
    controller.updateDrawing(id, patch);
  const setExt = (key: string, value: unknown) => update({ extendData: { [key]: value } });
  const hasLevels = LEVEL_TOOLS.has(overlay.name) && levels;
  const precision = controller.getSymbol()?.pricePrecision ?? 2;

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t.coinhub.tools.names[overlay.name] ?? overlay.name}</DialogTitle>
        <DialogDescription className="sr-only">{d.settings}</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue={options.some((o) => o.type === "text") ? "text" : "style"}>
        <TabsList className="w-full">
          <TabsTrigger value="style">{d.style}</TabsTrigger>
          {options.some((o) => o.type === "text") && <TabsTrigger value="text">{d.text}</TabsTrigger>}
          {hasLevels && <TabsTrigger value="levels">{d.levels}</TabsTrigger>}
          <TabsTrigger value="coordinates">{d.coordinates}</TabsTrigger>
        </TabsList>
        <TabsContent value="style" className="max-h-[50vh] space-y-1 overflow-y-auto pt-2">
          <Row label={d.color}>
            <ColorButton value={l.color} onChange={(color) => update({ styles: { line: { color } } })} />
          </Row>
          <Row label={d.lineWidth}>
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted",
                  l.width === w && "bg-muted",
                )}
                onClick={() => update({ styles: { line: { size: w } } })}
              >
                <span className="w-4 rounded-full bg-current" style={{ height: w }} />
              </button>
            ))}
          </Row>
          <Row label={d.lineStyle}>
            {(["solid", "dashed"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={l.lineStyle === s ? "secondary" : "ghost"}
                onClick={() => update({ styles: { line: { style: s, dashedValue: [6, 4] } } })}
              >
                {d[s]}
              </Button>
            ))}
          </Row>
          {TEXT_TOOLS.has(overlay.name) && (
            <Row label={d.textColor}>
              <ColorButton
                value={l.textColor}
                onChange={(color) => update({ styles: { text: { color } } })}
              />
              <Input
                type="number"
                className="w-20"
                value={l.fontSize}
                min={8}
                max={72}
                onChange={(e) => update({ styles: { text: { size: Number(e.target.value) || 12 } } })}
              />
            </Row>
          )}
          {options
            .filter((o) => o.type !== "text")
            .map((o) => (
              <Row key={o.key} label={d[o.label as keyof typeof d] as string}>
                {o.type === "bool" ? (
                  <Switch
                    checked={Boolean(
                      data[o.key] ??
                      (o.key === "fill" ||
                        o.key === "showPrices" ||
                        o.key === "showLevels" ||
                        o.key === "showMiddle" ||
                        o.key === "showPrice"),
                    )}
                    onCheckedChange={(v) => setExt(o.key, v)}
                  />
                ) : (
                  <Input
                    type="number"
                    className="w-28"
                    min={o.min}
                    step={o.step}
                    value={Number(
                      data[o.key] ??
                        (o.key === "accountSize"
                          ? 1000
                          : o.key === "riskPercent"
                            ? 1
                            : o.key === "rows"
                              ? 24
                              : o.key === "valueArea"
                                ? 70
                                : 2),
                    )}
                    onChange={(e) => setExt(o.key, Number(e.target.value))}
                  />
                )}
              </Row>
            ))}
        </TabsContent>
        {options.some((o) => o.type === "text") && (
          <TabsContent value="text" className="pt-2">
            <textarea
              autoFocus
              className="h-28 w-full rounded-md border bg-background p-2 text-sm"
              defaultValue={String(data.text ?? "")}
              onChange={(e) => setExt("text", e.target.value)}
            />
          </TabsContent>
        )}
        {hasLevels && (
          <TabsContent value="levels" className="max-h-[50vh] space-y-1 overflow-y-auto pt-2">
            {levels.map((lv, i) => (
              <div key={i} className="flex items-center gap-2">
                <Switch
                  checked={lv.visible}
                  onCheckedChange={(v) =>
                    setExt(
                      "levels",
                      levels.map((x, j) => (j === i ? { ...x, visible: v } : x)),
                    )
                  }
                />
                <Input
                  type="number"
                  step="any"
                  className="w-24"
                  value={lv.value}
                  onChange={(e) =>
                    setExt(
                      "levels",
                      levels.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)),
                    )
                  }
                />
                <ColorButton
                  value={lv.color}
                  onChange={(color) =>
                    setExt(
                      "levels",
                      levels.map((x, j) => (j === i ? { ...x, color } : x)),
                    )
                  }
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    setExt(
                      "levels",
                      levels.filter((_, j) => j !== i),
                    )
                  }
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setExt("levels", [...levels, { value: 1.5, color: "#2962ff", visible: true }])}
            >
              <PlusIcon />
              {d.addLevel}
            </Button>
          </TabsContent>
        )}
        <TabsContent value="coordinates" className="max-h-[50vh] space-y-1 overflow-y-auto pt-2">
          {overlay.points.map((p, i) => (
            <Row key={i} label={`#${i + 1} ${p.timestamp ? new Date(p.timestamp).toLocaleString() : ""}`}>
              <Input
                type="number"
                step="any"
                className="w-36"
                defaultValue={p.value !== undefined ? Number(p.value.toFixed(precision)) : ""}
                onBlur={(e) => {
                  const value = Number(e.target.value);
                  if (!Number.isFinite(value)) return;
                  controller.chart.overrideOverlay({
                    id,
                    points: overlay.points.map((q, j) => (j === i ? { ...q, value } : q)),
                  });
                  update({});
                }}
              />
            </Row>
          ))}
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button
          variant="ghost"
          className="mr-auto text-destructive"
          onClick={() => {
            controller.removeDrawing(id);
            closeDialog();
          }}
        >
          <Trash2Icon />
          {d.remove}
        </Button>
        <Button onClick={closeDialog}>{d.apply}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function DrawingSettingsDialog() {
  const dialog = useDialog("drawingSettings");
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => !o && closeDialog()}>
      {dialog && <DrawingSettingsBody key={dialog.id} chart={dialog.chart} id={dialog.id} />}
    </Dialog>
  );
}
