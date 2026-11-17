/**
 * Anti-hallucination check: every number the AI writes must be traceable to
 * the data it was given. Numbers that cannot be found are reported so the
 * editor can fix them before anything is published.
 */

const NUM = /(?<![\w.])[-−]?\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])[-−]?\$?\d+(?:\.\d+)?/g;

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(/[−]/g, "-").replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Collect every number in a value (string or nested object). */
export function numbersIn(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  else if (typeof value === "string") for (const m of value.matchAll(NUM)) { const n = toNumber(m[0]); if (n != null) out.push(n); }
  else if (Array.isArray(value)) value.forEach((v) => numbersIn(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => numbersIn(v, out));
  return out;
}

export interface Grounding {
  checked: number;
  unverified: string[];
}

/**
 * @param text  AI-written text
 * @param facts the data the AI was allowed to use (any shape)
 */
export function groundText(text: string, facts: unknown): Grounding {
  const known = numbersIn(facts).map((n) => Math.abs(n));
  const has = (v: number) => {
    const a = Math.abs(v);
    return known.some((k) => Math.abs(k - a) <= Math.max(0.011, a * 0.0005) || Math.abs(Math.round(k) - a) < 1e-9 || Math.abs(Number(k.toFixed(1)) - a) < 1e-9);
  };
  const unverified: string[] = [];
  let checked = 0;
  for (const m of text.matchAll(NUM)) {
    const raw = m[0];
    const n = toNumber(raw);
    if (n == null) continue;
    // Skip small counting words and years — they are rarely wrong and are not data.
    if (Number.isInteger(n) && Math.abs(n) <= 12 && !raw.includes("$")) continue;
    if (Number.isInteger(n) && n >= 2000 && n <= 2100) continue;
    // "per 100 kcal", "100 kcal step" — a unit, not a data point.
    if (n === 100 && /^\s*kcal/i.test(text.slice((m.index ?? 0) + raw.length))) continue;
    checked++;
    if (!has(n)) unverified.push(raw);
  }
  return { checked, unverified: [...new Set(unverified)] };
}
