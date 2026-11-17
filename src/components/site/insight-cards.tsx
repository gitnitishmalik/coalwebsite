import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Sparkles } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import type { Board, Check } from "@/lib/types";
import { hbaStats } from "@/lib/analytics";
import { fmtDate, pct, signed, signedUsd, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { checkCounts } from "@/lib/checks";
import { StatusIcon, levelLabel } from "./status-icon";
import { PossibilityBand } from "./possibility-band";

function AiChip({ children = "AI" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-accent px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-accent-foreground">
      <Sparkles className="size-3" />
      {children}
    </span>
  );
}

export function BriefCard({ board, className }: { board: Board; className?: string }) {
  const b = board.brief;
  return (
    <div className={cn("rounded-2xl border bg-white p-6", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <AiChip />
        <h3 className="text-lg font-bold">Market brief</h3>
        <span className={cn("ml-auto inline-flex items-center gap-1.5 text-xs font-medium", b.reviewedBy ? "text-good" : "text-warning")}>
          {b.reviewedBy ? <BadgeCheck className="size-4" /> : <Clock3 className="size-4" />}
          {b.reviewedBy ? `Reviewed by ${b.reviewedBy} · ${fmtDate(b.reviewedAt)}` : "AI draft · awaiting editor review"}
        </span>
      </div>
      <div className="mt-5 space-y-4">
        {b.paragraphs.map((p, i) => (
          <BlurFade key={i} inView delay={i * 0.08} className="flex gap-3">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <p className="text-[15px] leading-relaxed text-ink-soft">{p}</p>
          </BlurFade>
        ))}
      </div>
      <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">
        Written by Claude from the figures on this site only{b.generatedAt ? ` · ${fmtDate(b.generatedAt)}` : ""}. Not investment advice.
      </p>
    </div>
  );
}

export function PossibilityCard({ board, className }: { board: Board; className?: string }) {
  const s = hbaStats(board.hba);
  if (!s) return null;
  const upPct = Math.round((s.ups / s.pairs.length) * 100);
  return (
    <div className={cn("rounded-2xl border bg-white p-6", className)}>
      <div className="flex items-center gap-3">
        <AiChip />
        <h3 className="text-lg font-bold">Possibility range</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Next HBA revision, based on how the HBA actually moved in 2026.</p>
      <div className="tnum mt-5 text-4xl font-extrabold tracking-tight">
        {usd(s.band.low)} <span className="text-muted-foreground">–</span> {usd(s.band.high)}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Today’s {usd(s.last.value)} ± the average move of {usd(s.avgMove)}
      </p>
      <PossibilityBand now={s.last.value} low={s.band.low} high={s.band.high} spread={s.avgMove * 2.2} />
      <div className="mt-6">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${s.ups} rises and ${s.downs} falls`}>
          <div className="bg-up" style={{ width: `${upPct}%` }} />
          <div className="bg-down" style={{ width: `${100 - upPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs font-medium">
          <span className="text-up">▲ {s.ups} rises ({upPct}%)</span>
          <span className="text-down">{s.downs} falls ▼</span>
        </div>
      </div>
      <dl className="mt-5 divide-y text-sm">
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-muted-foreground">Momentum since the {s.peak.period} peak</dt>
          <dd className="text-right font-semibold">{s.momentum} · {s.sincePeak.downs} of {s.sincePeak.count} down</dd>
        </div>
        <div className="flex justify-between gap-4 py-2.5">
          <dt className="text-muted-foreground">Year to date ({s.ytd.from.period} → {s.last.period})</dt>
          <dd className={cn("tnum text-right font-semibold", s.ytd.change < 0 ? "text-down" : "text-up")}>
            {signedUsd(s.ytd.change)} ({pct(s.ytd.pct)})
          </dd>
        </div>
        {s.change != null && s.prev && (
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted-foreground">Latest revision ({s.prev.period} → {s.last.period})</dt>
            <dd className={cn("tnum text-right font-semibold", s.change < 0 ? "text-down" : "text-up")}>{signed(s.change)}</dd>
          </div>
        )}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">A range of typical outcomes, not a forecast or trading advice.</p>
    </div>
  );
}

export function ChecksList({ checks, limit, className, showLink }: { checks: Check[]; limit?: number; className?: string; showLink?: boolean }) {
  const c = checkCounts(checks);
  const list = limit ? checks.slice(0, limit) : checks;
  return (
    <div className={cn("rounded-2xl border bg-white p-6", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <AiChip>AUTO</AiChip>
        <h3 className="text-lg font-bold">Automated data checks</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {c.critical} critical · {c.warning} warnings · {c.info} notes · {c.pass} passed
        </span>
      </div>
      <ul className="mt-4 grid gap-x-8 md:grid-cols-2">
        {list.map((ch, i) => (
          <li key={ch.id} className="border-t">
            <BlurFade inView delay={i * 0.04} className="flex gap-3 py-3.5">
              <StatusIcon level={ch.level} className="mt-0.5 size-[18px]" />
              <div>
                <div className="text-sm font-semibold">
                  {ch.title}
                  <span className="ml-2 font-mono text-[10px] font-medium tracking-widest text-muted-foreground uppercase">{levelLabel(ch.level)}</span>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{ch.detail}</p>
              </div>
            </BlurFade>
          </li>
        ))}
      </ul>
      {showLink && limit && checks.length > limit && (
        <Link href="/insights" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          See all {checks.length} checks <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
