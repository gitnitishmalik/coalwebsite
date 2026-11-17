import type { Assessment, Board, HbaPoint, Region } from "./types";
import { utc } from "./format";

export type Row = Assessment & { region: Pick<Region, "id" | "label" | "basis"> };

export function allRows(board: Board): Row[] {
  return board.regions.flatMap((r) => r.rows.map((row) => ({ ...row, region: { id: r.id, label: r.label, basis: r.basis } })));
}

export function headline(board: Board): Row | null {
  const rows = allRows(board);
  return rows.find((r) => r.ref === "SCR#1") ?? rows[0] ?? null;
}

export const isConfirmed = (p: HbaPoint) => p.status === "official" || p.status === "corroborated";

export function sortedHba(hba: HbaPoint[]) {
  return [...hba].sort((a, b) => utc(a.date) - utc(b.date));
}

export function hbaStats(hbaIn: HbaPoint[]) {
  const hba = sortedHba(hbaIn);
  const obs = hba.filter((p) => p.value != null) as (HbaPoint & { value: number })[];
  if (!obs.length) return null;
  const last = obs[obs.length - 1];
  const idx = hba.indexOf(last);
  const prevCandidate = hba[idx - 1];
  const prev = prevCandidate && prevCandidate.value != null ? (prevCandidate as HbaPoint & { value: number }) : null;

  const pairs: { from: HbaPoint & { value: number }; to: HbaPoint & { value: number }; d: number }[] = [];
  for (let i = 1; i < hba.length; i++) {
    const a = hba[i - 1], b = hba[i];
    if (a.value != null && b.value != null) pairs.push({ from: a as never, to: b as never, d: b.value - a.value });
  }
  const ups = pairs.filter((p) => p.d > 0).length;
  const avgMove = pairs.length ? pairs.reduce((s, p) => s + Math.abs(p.d), 0) / pairs.length : 0;
  const peak = obs.reduce((a, p) => (p.value > a.value ? p : a));
  const sincePeak = pairs.filter((p) => utc(p.from.date) >= utc(peak.date));
  const downsSincePeak = sincePeak.filter((p) => p.d < 0).length;
  const first = obs[0];
  const momentum =
    sincePeak.length >= 3 && downsSincePeak >= Math.ceil(sincePeak.length * 0.6)
      ? "Softening"
      : pairs.length && ups / pairs.length >= 0.6
        ? "Firming"
        : "Mixed";

  return {
    hba,
    obs,
    last,
    prev,
    change: prev ? last.value - prev.value : null,
    pairs,
    ups,
    downs: pairs.length - ups,
    avgMove,
    peak,
    sincePeak: { count: sincePeak.length, downs: downsSincePeak },
    ytd: { from: first, change: last.value - first.value, pct: ((last.value - first.value) / first.value) * 100 },
    band: { low: last.value - avgMove, high: last.value + avgMove },
    momentum,
    missing: hba.filter((p) => p.value == null).length,
  };
}

export function sameDayHba(board: Board) {
  return board.hba.find((p) => p.date === board.meta.assessmentDate && p.value != null) ?? null;
}

export function ladderSlope(board: Board) {
  const pts = [...board.ladder].sort((a, b) => a.spec - b.spec);
  if (pts.length < 2) return null;
  const lo = pts[0], hi = pts[pts.length - 1];
  return { perStep: (hi.mid - lo.mid) / ((hi.spec - lo.spec) / 100), lo, hi };
}

export function nar6000(board: Board) {
  return allRows(board)
    .filter((r) => r.spec === 6000 && r.region.basis === "NAR")
    .map((r) => ({ ...r, name: r.region.id === "south-america" ? r.origin : `${r.region.label} ${r.origin}` }))
    .sort((a, b) => b.mid - a.mid);
}

export const rangeOf = (r: { low: number; high: number }) => ({ lo: Math.min(r.low, r.high), hi: Math.max(r.low, r.high) });
export const halfWidthPct = (r: { low: number; high: number; mid: number }) => {
  const { lo, hi } = rangeOf(r);
  return ((hi - lo) / 2 / r.mid) * 100;
};
