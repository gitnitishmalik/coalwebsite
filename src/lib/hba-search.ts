import "server-only";
import { searchHba } from "./ai";
import { getDraft, getPending, savePending } from "./store";
import type { HbaPoint, PendingHba } from "./types";

/**
 * Ask Claude to search the web for HBA releases we don't have yet and queue
 * them for editor approval. Never writes to the published board directly.
 * Shared by the admin button and the daily cron route.
 */
export async function runHbaSearch(by: PendingHba["foundBy"]) {
  const { board } = await getDraft();
  const pending = await getPending();
  const { findings, note } = await searchHba(board.hba);
  let added = 0;
  for (const f of findings) {
    if (!/^[A-Z][a-z]{2}-(I|II)$/.test(f.period) || !/^\d{4}-\d{2}-\d{2}$/.test(f.date) || !(f.value > 0 && f.value < 1000)) continue;
    const known = board.hba.find((p) => p.period === f.period && p.date.slice(0, 4) === f.date.slice(0, 4));
    const sameValue = known?.value != null && Math.abs(known.value - f.value) < 0.005;
    if (sameValue && known && (known.status === "official" || known.status === "corroborated")) continue;
    if (pending.some((p) => p.period === f.period && p.date === f.date && Math.abs((p.value ?? 0) - f.value) < 0.005)) continue;
    const sources = f.sources.filter((s) => /^https?:\/\//.test(s.url)).slice(0, 8);
    if (!sources.length) continue;
    const status: HbaPoint["status"] = f.ministryConfirmed ? "official" : sources.length >= 2 ? "corroborated" : "single";
    pending.unshift({
      id: crypto.randomUUID(),
      period: f.period,
      date: f.date,
      value: f.value,
      status,
      sources,
      foundAt: new Date().toISOString(),
      foundBy: by,
      note: known?.value != null && !sameValue ? `Differs from the recorded ${known.value}` : null,
    });
    added++;
  }
  await savePending(pending.slice(0, 50));
  return { added, note };
}
