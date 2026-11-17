import type { Metadata } from "next";
import { HbaExplorer } from "@/components/charts/hba-explorer";
import { HbaLegend } from "@/components/charts/hba-chart";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { HbaLedger } from "@/components/site/hba-ledger";
import { PageHeader, SectionHeading } from "@/components/site/section";
import { headline } from "@/lib/analytics";
import { getSiteData } from "@/lib/data";
import { pct, signed, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const metadata: Metadata = { title: "HBA benchmark", description: "Indonesia's Government Reference Price (HBA) for 6,322 GAR coal, with every source linked." };

export default async function BenchmarksPage() {
  const { board, stats } = await getSiteData();
  const head = headline(board);
  const tiles = stats
    ? [
        { label: `Latest · ${stats.last.period}`, value: stats.last.value, foot: stats.change != null ? `${signed(stats.change)} vs ${stats.prev?.period}` : "", tone: stats.change != null && stats.change < 0 ? "down" : "up" },
        { label: `Peak · ${stats.peak.period}`, value: stats.peak.value, foot: `${signed(stats.last.value - stats.peak.value)} since`, tone: "neutral" },
        { label: "Year to date", value: stats.ytd.change, foot: `${pct(stats.ytd.pct)} from ${stats.ytd.from.period}`, tone: stats.ytd.change < 0 ? "down" : "up", signed: true },
        { label: "Average move", value: stats.avgMove, foot: `across ${stats.pairs.length} revisions`, tone: "neutral" },
      ]
    : [];
  return (
    <>
      <PageHeader
        kicker="Benchmark"
        title="Indonesian Government Reference Price (HBA)"
        sub="Set by the Ministry of Energy and Mineral Resources (ESDM) twice a month. We collect every release, cross-check it against independent outlets, and link the proof."
      />
      <section className="container-x pt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <BlurFade key={t.label} delay={i * 0.06} className="rounded-2xl border bg-white p-5">
              <div className="text-sm text-muted-foreground">{t.label}</div>
              <div className="mt-2 text-3xl font-bold tracking-tight">
                {t.signed ? (t.value < 0 ? "−" : "+") : ""}$<NumberTicker value={Math.abs(t.value)} decimalPlaces={2} className="text-foreground" />
              </div>
              <div className={cn("mt-1 text-sm font-medium", t.tone === "down" ? "text-down" : t.tone === "up" ? "text-up" : "text-muted-foreground")}>{t.foot}</div>
            </BlurFade>
          ))}
        </div>
        <BlurFade inView className="mt-4 rounded-2xl border bg-white p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold">HBA 2026 · 6,322 GAR</h3>
              <p className="mt-1 text-sm text-muted-foreground">With the JCE SCR#1 assessment for comparison.</p>
            </div>
            <HbaLegend />
          </div>
          <div className="mt-4">
            <HbaExplorer hba={board.hba} jce={head ? { date: board.meta.assessmentDate, mid: head.mid, ref: head.ref } : null} height={380} />
          </div>
        </BlurFade>
      </section>
      <section className="container-x pt-16">
        <SectionHeading
          kicker="Ledger"
          title="Every period, with its proof"
          sub={`Official = Ministry release. Corroborated = two or more independent outlets agree. Single source values are shown hollow on the chart until a second source confirms them.${stats ? ` Latest: ${usd(stats.last.value)}.` : ""}`}
        />
        <BlurFade inView>
          <HbaLedger hba={board.hba} />
        </BlurFade>
      </section>
    </>
  );
}
