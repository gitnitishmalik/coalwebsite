import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { NumberTicker } from "@/components/ui/number-ticker";
import { buttonVariants } from "@/components/ui/button";
import type { Board, FxRate } from "@/lib/types";
import { headline, hbaStats, sameDayHba } from "@/lib/analytics";
import { fmtDate, num, signedUsd, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeBar } from "./range-bar";
import { Sparkline } from "./sparkline";

export function Hero({ board, fx }: { board: Board; fx: FxRate }) {
  const head = headline(board);
  const stats = hbaStats(board.hba);
  const same = sameDayHba(board);
  const rows = board.regions.reduce((n, r) => n + r.rows.length, 0);

  return (
    <section className="relative overflow-hidden">
      <AnimatedGridPattern
        numSquares={36}
        maxOpacity={0.12}
        duration={3.5}
        className="pointer-events-none inset-x-0 inset-y-[-20%] h-[140%] fill-primary/30 stroke-primary/10 text-primary [mask-image:radial-gradient(60%_60%_at_70%_30%,white,transparent)]"
      />
      <div className="pointer-events-none absolute -top-40 right-[-10%] size-[640px] rounded-full bg-[radial-gradient(closest-side,oklch(0.93_0.06_60),transparent)]" />

      <div className="container-x relative grid items-center gap-12 pt-14 pb-16 md:pt-20 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
        <div>
          {stats && (
            <BlurFade delay={0.05}>
              <Link
                href="/benchmarks"
                className="group inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition hover:shadow"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-good" />
                </span>
                <AnimatedShinyText className="mx-0 max-w-none text-foreground/80">
                  HBA {stats.last.period} {usd(stats.last.value)} · verified by {stats.last.sources.length} sources
                </AnimatedShinyText>
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </BlurFade>
          )}
          <BlurFade delay={0.12}>
            <h1 className="mt-6 text-[2.6rem] leading-[1.05] font-extrabold tracking-tight text-balance md:text-6xl">
              Coal prices,{" "}
              <span className="bg-gradient-to-r from-amber-500 via-orange-600 to-orange-800 bg-clip-text text-transparent">independently discovered</span>{" "}
              and proven.
            </h1>
          </BlurFade>
          <BlurFade delay={0.2}>
            <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
              Jakarta Coal Exchange publishes independent assessments for Indonesian, South American, Russian and US coal — cross-checked against
              the Indonesian Government Reference Price and independent reports, with every source one click away.
            </p>
          </BlurFade>
          <BlurFade delay={0.28} className="mt-8 flex flex-wrap gap-3">
            <Link href="/prices" className={cn(buttonVariants({ size: "lg" }), "h-11 px-5 text-[15px]")}>
              View the price board <ArrowRight />
            </Link>
            <Link href="/methodology" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 bg-white px-5 text-[15px]")}>
              <ShieldCheck /> How we verify
            </Link>
          </BlurFade>
          <BlurFade delay={0.36} className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t pt-6">
            {[
              [rows, "assessments"],
              [board.hba.filter((p) => p.value != null).length, "HBA periods"],
              [board.ladder.length, "ladder grades"],
            ].map(([n, l]) => (
              <div key={l as string}>
                <NumberTicker value={n as number} className="text-2xl font-bold tracking-tight text-foreground" />
                <div className="mt-0.5 text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </BlurFade>
        </div>

        {head && (
          <BlurFade delay={0.25} direction="up">
            <div className="relative overflow-hidden rounded-2xl border bg-white p-6 shadow-[0_24px_60px_-28px_rgba(194,65,12,.35)] md:p-8">
              <BorderBeam size={140} duration={9} colorFrom="#f59e0b" colorTo="#c2410c" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-xs font-semibold text-primary-foreground">{head.ref}</span>
                  <span className="text-sm text-muted-foreground">
                    {head.origin} {num(head.spec)} {head.region.basis} · FOB
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(board.meta.assessmentDate)}</span>
              </div>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-muted-foreground">$</span>
                <NumberTicker value={head.mid} decimalPlaces={2} startValue={Math.floor(head.mid * 0.9)} className="text-6xl font-bold tracking-tight text-foreground md:text-7xl" />
                <span className="ml-1 text-xl text-muted-foreground">/t</span>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <RangeBar mid={head.mid} low={head.low} high={head.high} className="w-40" />
                <span className="tnum text-sm text-muted-foreground">
                  {usd(head.low)} – {usd(head.high)}
                </span>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-5 text-sm">
                <div>
                  <dt className="text-muted-foreground">In rupiah</dt>
                  <dd className="tnum mt-1 font-semibold">Rp {num(Math.round(head.mid * fx.rate))}</dd>
                  <dd className="text-xs text-muted-foreground">{fx.live ? "Live" : "Cached"} ECB · {num(fx.rate)}</dd>
                </div>
                {same?.value != null && (
                  <div>
                    <dt className="text-muted-foreground">vs HBA {same.period}</dt>
                    <dd className={cn("tnum mt-1 font-semibold", head.mid - same.value < 0 ? "text-down" : "text-up")}>{signedUsd(head.mid - same.value)}/t</dd>
                    <dd className="text-xs text-muted-foreground">HBA {usd(same.value)}</dd>
                  </div>
                )}
              </dl>
              {stats && (
                <div className="mt-5 rounded-xl bg-muted/60 p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>HBA 2026 · 6,322 GAR</span>
                    <span className="tnum font-medium text-foreground">{usd(stats.last.value)}</span>
                  </div>
                  <Sparkline values={stats.obs.map((p) => p.value)} className="mt-2 h-10 w-full" />
                </div>
              )}
            </div>
          </BlurFade>
        )}
      </div>
    </section>
  );
}
