// Locale-aware number, date and relative-time formatting. Nothing here
// hardcodes a format string: every call reads the browser's own locale list
// (or an explicit override, for the de-DE / en-GB proof in C18) through the
// standard Intl constructors, so "1.234,56" in German and "1,234.56" in
// English both fall out of the same code path.

export function formatInt(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
}

export function formatDate(value: Date | string, locale?: string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

// Returns a duration phrase such as "3 hours" or "2 days", used inside the
// check.cacheAge message rather than a full relative sentence, because the
// cache-age line supplies its own leading and trailing words per the design.
export function formatAge(ms: number, locale?: string): string {
  const abs = Math.max(0, ms);
  for (const [unit, unitMs] of RELATIVE_UNITS) {
    const value = Math.floor(abs / unitMs);
    if (value >= 1) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "long" });
      const parts = rtf.formatToParts(-value, unit);
      return parts
        .filter((p) => p.type !== "literal" || !/^ago$|^in$/i.test(p.value.trim()))
        .map((p) => p.value)
        .join("")
        .replace(/^in\s+|\s+ago$/gi, "")
        .trim();
    }
  }
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "long" });
  const parts = rtf.formatToParts(-1, "minute");
  return parts
    .map((p) => p.value)
    .join("")
    .replace(/^in\s+|\s+ago$/gi, "")
    .trim();
}
