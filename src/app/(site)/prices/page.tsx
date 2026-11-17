import type { Metadata } from "next";
import { LadderChart } from "@/components/charts/ladder-chart";
import { OriginsChart } from "@/components/charts/origins-chart";
import { BlurFade } from "@/components/ui/blur-fade";
import { PriceBoard } from "@/components/site/price-board";
import { PageHeader, SectionHeading } from "@/components/site/section";
import { nar6000 } from "@/lib/analytics";
import { getSiteData } from "@/lib/data";
import { fmtDate, fmtDateTime, num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";

export const revalidate = 300;
export const metadata: Metadata = { title: "Price board", description: "JCE physical coal assessments for Indonesia, South America, Russia and the USA." };

export default async function PricesPage() {
  const { board, fx } = await getSiteData();
  const overdue = Date.parse(board.meta.nextUpdate) < Date.now();
  return (
    <>
      <PageHeader
        kicker="Price board"
        title="Physical coal assessments"
        sub="Independent mid prices with their assessed range, in USD per tonne. Search, sort or export the board as CSV."
      >
        <div className="mt-8 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border bg-white px-3 py-1.5">Assessment <b className="ml-1">{fmtDate(board.meta.assessmentDate)}</b></span>
          <span className={cn("rounded-full border bg-white px-3 py-1.5", overdue && "border-warning/50")}>
            Next update <b className="ml-1">{fmtDate(board.meta.nextUpdate)}</b>
            {overdue && <span className="ml-1 font-medium text-warning">· overdue</span>}
          </span>
          {board.meta.publishedAt && <span className="rounded-full border bg-white px-3 py-1.5">Published <b className="ml-1">{fmtDateTime(board.meta.publishedAt)}</b></span>}
          <span className="rounded-full border bg-white px-3 py-1.5">USD/IDR <b className="ml-1">{num(fx.rate)}</b> <span className="text-muted-foreground">({fx.live ? "live" : "cached"})</span></span>
        </div>
      </PageHeader>

      <section className="container-x pt-12">
        <BlurFade>
          <PriceBoard regions={board.regions} fxRate={fx.rate} assessmentDate={board.meta.assessmentDate} />
        </BlurFade>
      </section>

      <section className="container-x grid gap-4 pt-16 lg:grid-cols-2">
        <BlurFade inView className="rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-bold">6,000 NAR across origins</h3>
          <p className="mt-1 text-sm text-muted-foreground">Mid price, USD/t.</p>
          <div className="mt-6"><OriginsChart data={nar6000(board).map((r) => ({ name: r.name, code: r.ref, mid: r.mid, low: r.low, high: r.high }))} /></div>
        </BlurFade>
        <BlurFade inView delay={0.06} className="rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-bold">Indonesian GAR ladder</h3>
          <p className="mt-1 text-sm text-muted-foreground">{board.ladder.length} grades, {num(Math.min(...board.ladder.map((p) => p.spec)))}–{num(Math.max(...board.ladder.map((p) => p.spec)))} GAR.</p>
          <div className="mt-4"><LadderChart ladder={board.ladder} /></div>
        </BlurFade>
      </section>

      <section className="container-x pt-16">
        <SectionHeading kicker="Ladder" title="Indonesian GAR ladder — full table" />
        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-5 py-3 font-medium">GAR</th>
                  <th className="px-5 py-3 font-medium">Ref</th>
                  <th className="px-5 py-3 text-right font-medium">Mid</th>
                  <th className="px-5 py-3 text-right font-medium">Low</th>
                  <th className="px-5 py-3 text-right font-medium">High</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {board.ladder.map((p) => (
                  <tr key={p.spec} className={cn("border-b last:border-0", p.ref && "bg-accent/40")}>
                    <td className="tnum px-5 py-2.5">{num(p.spec)}</td>
                    <td className="px-5 py-2.5 font-mono text-xs font-semibold text-primary">{p.ref ?? ""}</td>
                    <td className="tnum px-5 py-2.5 text-right font-bold">{usd(p.mid)}</td>
                    <td className="tnum px-5 py-2.5 text-right text-muted-foreground">{usd(p.low)}</td>
                    <td className="tnum px-5 py-2.5 text-right text-muted-foreground">{usd(p.high)}</td>
                    <td className="px-5 py-2.5 text-xs text-muted-foreground">{p.reconstructed ? "Reconstructed (unreadable in source)" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
