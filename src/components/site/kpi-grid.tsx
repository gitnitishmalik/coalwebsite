import { ArrowDownRight, ArrowUpRight, Banknote, Flame, Landmark, Scale } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import type { Board, FxRate } from "@/lib/types";
import { headline, hbaStats, ladderSlope, sameDayHba } from "@/lib/analytics";
import { fmtDate, num, pct, signed, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

function Card({ icon: Icon, label, children, foot, delay }: { icon: React.ElementType; label: string; children: React.ReactNode; foot?: React.ReactNode; delay: number }) {
  return (
    <BlurFade inView delay={delay} className="group relative flex flex-col rounded-2xl border bg-white p-5 transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(15,23,42,.25)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground transition-transform group-hover:scale-110">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3">{children}</div>
      {foot && <div className="mt-auto pt-3 text-xs text-muted-foreground">{foot}</div>}
    </BlurFade>
  );
}

export function KpiGrid({ board, fx }: { board: Board; fx: FxRate }) {
  const stats = hbaStats(board.hba);
  const head = headline(board);
  const same = sameDayHba(board);
  const slope = ladderSlope(board);
  const spread = head && same?.value != null ? head.mid - same.value : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats && (
        <Card icon={Landmark} label={`HBA ${stats.last.period} · 6,322 GAR`} delay={0} foot={<Sparkline values={stats.obs.slice(-12).map((p) => p.value)} className="h-9 w-full" />}>
          <div className="text-3xl font-bold tracking-tight">
            $<NumberTicker value={stats.last.value} decimalPlaces={2} startValue={Math.floor(stats.last.value * 0.92)} className="text-foreground" />
          </div>
          {stats.change != null && stats.prev && (
            <div className={cn("mt-1 inline-flex items-center gap-1 text-sm font-semibold", stats.change < 0 ? "text-down" : "text-up")}>
              {stats.change < 0 ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
              {signed(stats.change)} ({pct((stats.change / stats.prev.value) * 100, 2)})
              <span className="font-normal text-muted-foreground">vs {stats.prev.period}</span>
            </div>
          )}
        </Card>
      )}
      {head && spread != null && same && (
        <Card icon={Scale} label="JCE SCR#1 vs HBA" delay={0.06} foot={`${usd(head.mid)} vs ${usd(same.value!)} · ${same.period} (same period)`}>
          <div className={cn("text-3xl font-bold tracking-tight", spread < 0 ? "text-down" : "text-up")}>
            {spread < 0 ? "−" : "+"}$<NumberTicker value={Math.abs(spread)} decimalPlaces={2} className={spread < 0 ? "text-down" : "text-up"} />
            <span className="text-lg font-semibold text-muted-foreground">/t</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{pct((spread / same.value!) * 100)} {spread < 0 ? "below" : "above"} the government reference</div>
        </Card>
      )}
      {slope && (
        <Card icon={Flame} label="Value of 100 kcal (GAR)" delay={0.12} foot={`Indonesian ladder ${num(slope.lo.spec)} → ${num(slope.hi.spec)} GAR`}>
          <div className="text-3xl font-bold tracking-tight">
            $<NumberTicker value={slope.perStep} decimalPlaces={2} className="text-foreground" />
            <span className="text-lg font-semibold text-muted-foreground">/t</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">average price step per 100 kcal/kg</div>
        </Card>
      )}
      <Card icon={Banknote} label="USD / IDR" delay={0.18} foot={`${fx.live ? "Live" : "Cached"} · ${fx.source} · ${fmtDate(fx.date)}`}>
        <div className="text-3xl font-bold tracking-tight">
          <NumberTicker value={fx.rate} startValue={Math.floor(fx.rate * 0.97)} className="text-foreground" />
        </div>
        <div className="mt-1 text-sm text-muted-foreground">used for every rupiah price on this site</div>
      </Card>
    </div>
  );
}
