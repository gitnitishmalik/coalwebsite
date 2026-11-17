import { Marquee } from "@/components/ui/marquee";
import type { Board, FxRate } from "@/lib/types";
import { allRows, hbaStats } from "@/lib/analytics";
import { num, signed, usd } from "@/lib/format";

export function PriceTicker({ board, fx }: { board: Board; fx: FxRate }) {
  const stats = hbaStats(board.hba);
  const items = [
    ...(stats
      ? [{ k: `HBA ${stats.last.period}`, v: usd(stats.last.value), d: stats.change, tag: "6,322 GAR" }]
      : []),
    ...allRows(board).map((r) => ({ k: r.ref, v: usd(r.mid), d: null as number | null, tag: `${r.region.id === "south-america" || r.region.id === "indonesia" ? r.origin : `${r.region.label} ${r.origin}`} ${num(r.spec)} ${r.region.basis}` })),
    { k: "USD/IDR", v: num(fx.rate), d: null, tag: fx.live ? "ECB live" : "ECB cached" },
  ];
  return (
    <div className="relative border-y bg-white" aria-label="Price ticker">
      <Marquee pauseOnHover className="py-0 [--duration:70s] [--gap:0rem]" repeat={3}>
        {items.map((it, i) => (
          <span key={i} className="flex items-center gap-2 border-r px-5 py-3 text-sm whitespace-nowrap">
            <span className="font-mono text-xs font-semibold text-primary">{it.k}</span>
            <span className="text-muted-foreground">{it.tag}</span>
            <span className="tnum font-semibold">{it.v}</span>
            {it.d != null && (
              <span className={it.d < 0 ? "tnum text-xs font-semibold text-down" : "tnum text-xs font-semibold text-up"}>
                {it.d < 0 ? "▼" : "▲"} {signed(it.d)}
              </span>
            )}
          </span>
        ))}
      </Marquee>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white" />
    </div>
  );
}
