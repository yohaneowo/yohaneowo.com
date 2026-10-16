import { useState } from "react";
import { useLocale } from "@/i18n/locale-provider";

export type CycleOption<T extends string> = {
  value: T;
  name: string;
  // Short brand label for the compact chip (IMDb, RT, TMDB, MC).
  short: string;
  color: string;
  // Text color on the brand color.
  ink: string;
};

const CYCLE_ICON = (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 11a8 8 0 0 0-14.9-3.9M4 4v4h4" />
    <path d="M4 13a8 8 0 0 0 14.9 3.9M20 20v-4h-4" />
  </svg>
);

// One button that steps through options: click for the next, Shift+click for the previous.
// "full" shows the label, the current option, position dots and (on hover) the next one;
// "chip" is a small button in the current option's brand colors.
export function CycleButton<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = "full",
}: {
  options: CycleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: "full" | "chip";
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const current = options[index];
  const next = options[(index + 1) % options.length];
  // The icon always turns the way you step, so it is never reset to 0.
  const [spins, setSpins] = useState(0);
  // The swap animation plays only after a click, not on first render.
  const [stepped, setStepped] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { t } = useLocale();

  function step(direction: 1 | -1) {
    const target = options[(index + direction + options.length) % options.length];
    setSpins((count) => count + direction);
    setStepped(true);
    setAnnouncement(t.profile.cycleSwitched(target.name));
    onChange(target.value);
  }

  const common = {
    type: "button" as const,
    title: t.profile.cycleTitle(next.name),
    "aria-label": t.profile.cycleAria(label, current.name, index + 1, options.length, next.name),
    onClick: (event: React.MouseEvent) => step(event.shiftKey ? -1 : 1),
  };
  const live = (
    <span className="sr-only" aria-live="polite">
      {announcement}
    </span>
  );

  if (variant === "chip") {
    return (
      <>
        <button {...common} className="cycle-chip" style={{ background: current.color, color: current.ink }}>
          <span key={current.value} className={stepped ? "swap" : undefined}>
            {current.short}
          </span>
          {/* The same turn-around icon as the full button: it reads as "click for the next one". */}
          <span className="ic" aria-hidden="true" style={{ transform: `rotate(${spins * 180}deg)` }}>
            {CYCLE_ICON}
          </span>
        </button>
        {live}
      </>
    );
  }
  return (
    <>
      <button {...common} className="cycle">
        <span className="lbl">{label}</span>
        <span key={current.value} className={stepped ? "nm anim" : "nm"}>
          <i style={{ background: current.color }} />
          <span>{current.name}</span>
        </span>
        <span className="dots" aria-hidden="true">
          {options.map((option, position) => (
            <i key={option.value} className={position === index ? "on" : undefined} />
          ))}
        </span>
        <span className="nx">{t.profile.next(next.name)}</span>
        <span className="ic" aria-hidden="true" style={{ transform: `rotate(${spins * 180}deg)` }}>
          {CYCLE_ICON}
        </span>
      </button>
      {live}
    </>
  );
}
