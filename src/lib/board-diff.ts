import type { Board, LadderPoint, Region } from "./types";

export interface PriceChange {
  ref: string;
  label: string;
  before: number | null;
  after: number;
  delta: number | null;
  pct: number | null;
}

/** Deterministic comparison of proposed rows against the live board. */
export function diffRows(live: Board, regions: Region[]): PriceChange[] {
  const old = new Map(live.regions.flatMap((r) => r.rows.map((row) => [row.ref, row] as const)));
  return regions.flatMap((r) =>
    r.rows.map((row) => {
      const o = old.get(row.ref);
      const delta = o ? row.mid - o.mid : null;
      return {
        ref: row.ref,
        label: `${r.label} · ${row.origin} ${row.spec} ${r.basis}`,
        before: o?.mid ?? null,
        after: row.mid,
        delta: delta == null ? null : Math.round(delta * 100) / 100,
        pct: delta == null || !o ? null : Math.round((delta / o.mid) * 10000) / 100,
      };
    }),
  );
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "region";

/** Merge extracted regions/ladder into a board (matching regions by label). */
export function mergeExtraction(board: Board, x: { regions: Region[]; ladder: LadderPoint[]; assessmentDate?: string | null }, imageUrl?: string | null): Board {
  const regions = x.regions.length
    ? x.regions.map((er) => {
        const existing = board.regions.find((r) => r.label.toLowerCase() === er.label.toLowerCase() || r.id === slug(er.label));
        return { ...er, id: existing?.id ?? slug(er.label), label: existing?.label ?? er.label };
      })
    : board.regions;
  return {
    ...board,
    regions,
    ladder: x.ladder.length ? x.ladder : board.ladder,
    meta: { ...board.meta, assessmentDate: x.assessmentDate && /^\d{4}-\d{2}-\d{2}$/.test(x.assessmentDate) ? x.assessmentDate : board.meta.assessmentDate },
    settings: { ...board.settings, boardImageUrl: imageUrl ?? board.settings.boardImageUrl },
  };
}
