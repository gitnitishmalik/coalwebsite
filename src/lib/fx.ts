import "server-only";
import type { FxRate } from "./types";

const FALLBACK: FxRate = { rate: 18259, date: "2026-11-16", live: false, source: "ECB reference rate (cached)" };

/** USD → IDR from the ECB reference rate (Frankfurter, no key). Cached for an hour. */
export async function getUsdIdr(): Promise<FxRate> {
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?from=USD&to=IDR", {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return FALLBACK;
    const j = (await res.json()) as { date: string; rates: { IDR?: number } };
    return j.rates.IDR ? { rate: j.rates.IDR, date: j.date, live: true, source: "ECB reference rate via Frankfurter" } : FALLBACK;
  } catch {
    return FALLBACK;
  }
}
