/**
 * Anti-hallucination check: every number the AI writes must be traceable to
 * the data it was given. Numbers that cannot be found are reported so the
 * editor can fix them before anything is published. Simple arithmetic on two
 * facts (a difference, a sum, a % change) is reported separately as "derived".
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
  derived?: string[];
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * 0.0005);

/**
 * @param text  AI-written text
 * @param facts the data the AI was allowed to use (any shape)
 * @param opts.derived also accept a±b and (a−b)/b·100 of two facts, reported as derived
 */
export function groundText(text: string, facts: unknown, opts: { derived?: boolean } = {}): Grounding {
  const known = [...new Set(numbersIn(facts).map((n) => Math.abs(n)))];
  const has = (a: number) =>
    known.some((k) => close(a, k) || Math.abs(Math.round(k) - a) < 1e-9 || Math.abs(Number(k.toFixed(1)) - a) < 1e-9);
  const isDerived = (a: number) => {
    const small = known.filter((k) => k > 0 && k < 100_000).slice(0, 400);
    for (let i = 0; i < small.length; i++)
      for (let j = 0; j < small.length; j++) {
        if (i === j) continue;
        const x = small[i], y = small[j];
        if (close(a, Math.abs(x - y)) || close(a, x + y)) return true;
        const pct = (Math.abs(x - y) / y) * 100;
        if (Math.abs(pct - a) < 0.051 || Math.abs(Math.round(pct * 10) / 10 - a) < 1e-9) return true;
      }
    return false;
  };
  const unverified: string[] = [], derived: string[] = [];
  let checked = 0;
  for (const m of text.matchAll(NUM)) {
    const raw = m[0];
    const n = toNumber(raw);
    if (n == null) continue;
    const a = Math.abs(n);
    // Skip small counting words and years — they are rarely wrong and are not data.
    if (Number.isInteger(n) && a <= 12 && !raw.includes("$")) continue;
    if (Number.isInteger(n) && n >= 2000 && n <= 2100) continue;
    // "per 100 kcal", "100 kcal step" — a unit, not a data point.
    if (n === 100 && /^\s*kcal/i.test(text.slice((m.index ?? 0) + raw.length))) continue;
    checked++;
    if (has(a)) continue;
    if (opts.derived && isDerived(a)) derived.push(raw);
    else unverified.push(raw);
  }
  return { checked, unverified: [...new Set(unverified)], ...(opts.derived ? { derived: [...new Set(derived)] } : {}) };
}
