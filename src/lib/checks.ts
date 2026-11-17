import type { Board, Check } from "./types";
import { allRows, hbaStats, isConfirmed, sameDayHba, sortedHba } from "./analytics";
import { fmtDate, usd, utc } from "./format";

/**
 * Automated pre-publish checks. Pure rules over the board — run on every
 * render of the admin panel and the public insight page, so the list is
 * always in step with the data.
 */
export function runChecks(board: Board, now = Date.now()): Check[] {
  const out: Check[] = [];
  const rows = allRows(board);

  // 1. Inverted ranges
  const inverted = rows.filter((r) => r.low > r.high);
  for (const r of inverted) {
    out.push({
      id: `inverted-${r.ref}`,
      level: "critical",
      title: `${r.ref} range is inverted`,
      detail: `Low ${usd(r.low)} is above high ${usd(r.high)}. Swap the values before publishing.`,
    });
  }

  // 2. Mid outside its own range
  for (const r of rows) {
    const lo = Math.min(r.low, r.high), hi = Math.max(r.low, r.high);
    if (r.mid < lo - 0.005 || r.mid > hi + 0.005)
      out.push({ id: `mid-${r.ref}`, level: "critical", title: `${r.ref} mid sits outside its range`, detail: `Mid ${usd(r.mid)} vs range ${usd(lo)}–${usd(hi)}.` });
  }

  // 3. Duplicate references
  const seen = new Map<string, number>();
  rows.forEach((r) => seen.set(r.ref, (seen.get(r.ref) ?? 0) + 1));
  for (const [ref, n] of seen) if (n > 1) out.push({ id: `dup-${ref}`, level: "warning", title: `${ref} appears ${n} times`, detail: "Each reference should be used once on the board." });

  // 4. Board vs ladder disagreement
  const mismatched = board.ladder
    .filter((p) => p.ref)
    .map((p) => ({ p, row: rows.find((r) => r.ref === p.ref) }))
    .filter(({ p, row }) => row && Math.abs(row.mid - p.mid) > 0.005);
  if (mismatched.length) {
    const ex = mismatched[0];
    out.push({
      id: "ladder-mismatch",
      level: "warning",
      title: `Board and ladder disagree on ${mismatched.length} reference${mismatched.length > 1 ? "s" : ""}`,
      detail: `e.g. ${ex.p.ref}: board ${usd(ex.row!.mid)} vs ladder ${usd(ex.p.mid)}. Confirm which is current.`,
    });
  }

  // 5. Reconstructed ladder values
  const recon = board.ladder.filter((p) => p.reconstructed);
  if (recon.length)
    out.push({
      id: "reconstructed",
      level: "warning",
      title: `${recon.length} ladder values are reconstructed`,
      detail: `${recon.map((p) => p.spec.toLocaleString("en-US")).join(" / ")} GAR were unreadable in the source and rebuilt from the published range.`,
    });

  // 6. Stale schedule
  if (utc(board.meta.nextUpdate) < now)
    out.push({
      id: "overdue",
      level: "warning",
      title: "Next-update date has passed",
      detail: `The board promised an update on ${fmtDate(board.meta.nextUpdate)}. Latest assessment is ${fmtDate(board.meta.assessmentDate)}.`,
    });

  // 7. Gaps in SCR numbering
  const nums = rows.map((r) => /^SCR#(\d+)$/.exec(r.ref)?.[1]).filter(Boolean).map(Number);
  if (nums.length) {
    const missing: number[] = [];
    for (let i = Math.min(...nums); i <= Math.max(...nums); i++) if (!nums.includes(i)) missing.push(i);
    if (missing.length)
      out.push({ id: "gap", level: "info", title: `SCR#${missing.join(", SCR#")} not on the board`, detail: "Confirm whether the reference was retired or is missing." });
  }

  // 8. HBA ledger quality
  const stats = hbaStats(board.hba);
  if (stats) {
    if (stats.missing)
      out.push({ id: "hba-missing", level: "info", title: `${stats.missing} HBA period${stats.missing > 1 ? "s" : ""} not yet verified`, detail: sortedHba(board.hba).filter((p) => p.value == null).map((p) => p.period).join(", ") + " — add a source to fill the gap." });
    const weak = stats.obs.filter((p) => !isConfirmed(p));
    if (weak.length)
      out.push({ id: "hba-weak", level: "info", title: `${weak.length} HBA values rely on one source`, detail: "A second outlet or the Ministry decree will upgrade them to confirmed." });
    const jumps = stats.pairs.filter((p) => Math.abs(p.d / p.from.value) > 0.1);
    for (const j of jumps)
      out.push({ id: `hba-jump-${j.to.period}`, level: "warning", title: `HBA ${j.to.period} moved ${((j.d / j.from.value) * 100).toFixed(1)}%`, detail: `From ${usd(j.from.value)} to ${usd(j.to.value)}. Double-check against the decree.` });
    if (isConfirmed(stats.last))
      out.push({ id: "hba-latest", level: "pass", title: `Latest HBA (${stats.last.period}) is confirmed`, detail: `${usd(stats.last.value)} — ${stats.last.sources.length} source${stats.last.sources.length > 1 ? "s" : ""} agree.` });
  }

  // 9. JCE vs HBA sanity
  const head = rows.find((r) => r.ref === "SCR#1");
  const same = sameDayHba(board);
  if (head && same?.value) {
    const gap = ((head.mid - same.value) / same.value) * 100;
    out.push(
      Math.abs(gap) > 15
        ? { id: "spread", level: "warning", title: `SCR#1 is ${gap.toFixed(1)}% from the HBA`, detail: `${usd(head.mid)} vs HBA ${same.period} ${usd(same.value)}. Large gaps deserve a note.` }
        : { id: "spread", level: "pass", title: "SCR#1 is within 15% of the HBA", detail: `${usd(head.mid)} vs HBA ${same.period} ${usd(same.value)} (${gap > 0 ? "+" : ""}${gap.toFixed(1)}%).` },
    );
  }

  // 10. Ranges overall
  if (!inverted.length && rows.length) out.push({ id: "ranges-ok", level: "pass", title: "All ranges are well-formed", detail: `${rows.length} assessments checked.` });

  // 11. Brief review
  if (board.brief.paragraphs.length && !board.brief.reviewedBy)
    out.push({ id: "brief", level: "info", title: "AI brief awaiting editor review", detail: "Mark it reviewed in Admin → Insights before it is shown as approved." });

  const order = { critical: 0, warning: 1, info: 2, pass: 3 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

export function checkCounts(checks: Check[]) {
  return {
    critical: checks.filter((c) => c.level === "critical").length,
    warning: checks.filter((c) => c.level === "warning").length,
    info: checks.filter((c) => c.level === "info").length,
    pass: checks.filter((c) => c.level === "pass").length,
  };
}
