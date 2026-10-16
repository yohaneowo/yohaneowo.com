// Number formatting shared by the terminal and the dashboard.

export function fmtNumber(value: number, precision = 2) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function fmtCompact(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const units: Array<[number, string]> = [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, unit] of units) if (abs >= size) return `${(value / size).toFixed(digits)}${unit}`;
  return value.toFixed(abs < 1 ? 4 : abs < 10 ? 2 : 0);
}

export function fmtPercent(value: number, digits = 2, sign = true) {
  if (!Number.isFinite(value)) return "—";
  return `${sign && value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

// A sensible precision for an arbitrary price (watchlist rows of mixed symbols).
export function autoPrecision(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1000) return 2;
  if (abs >= 1) return abs >= 100 ? 2 : 4;
  if (abs >= 0.01) return 5;
  return 8;
}

export function fmtPrice(value: number, precision?: number) {
  return fmtNumber(value, precision ?? autoPrecision(value));
}
