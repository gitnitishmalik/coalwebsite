import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HbaChart, HbaLegend } from "@/components/charts/hba-chart";
import { LadderChart } from "@/components/charts/ladder-chart";
import { OriginsChart } from "@/components/charts/origins-chart";
import { BlurFade } from "@/components/ui/blur-fade";
import { buttonVariants } from "@/components/ui/button";
import { Hero } from "@/components/site/hero";
import { BriefCard, ChecksList, PossibilityCard } from "@/components/site/insight-cards";
import { KpiGrid } from "@/components/site/kpi-grid";
import { PriceBoard } from "@/components/site/price-board";
import { SectionHeading } from "@/components/site/section";
import { SourcesTable } from "@/components/site/sources-table";
import { PriceTicker } from "@/components/site/ticker";
import { VerificationFlow } from "@/components/site/verification-flow";
import { headline, nar6000 } from "@/lib/analytics";
import { getSiteData } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export default async function HomePage() {
  const { board, fx, checks } = await getSiteData();
  const head = headline(board);

  return (
    <>
      <Hero board={board} fx={fx} />
      <PriceTicker board={board} fx={fx} />

      <section className="container-x pt-16">
        <KpiGrid board={board} fx={fx} />
      </section>

      <section className="container-x pt-24">
        <SectionHeading
          kicker="Price board"
          title="Physical coal assessments"
          sub={`USD per tonne, assessed ${fmtDate(board.meta.assessmentDate)}. Range bars share a ±4% scale so you can see how tight each assessment is.`}
          action={
            <Link href="/prices" className={cn(buttonVariants({ variant: "outline" }), "bg-white")}>
              Full board <ArrowRight />
            </Link>
          }
        />
        <BlurFade inView>
          <PriceBoard regions={board.regions} fxRate={fx.rate} assessmentDate={board.meta.assessmentDate} compact />
        </BlurFade>
      </section>

      <section className="container-x pt-24">
        <SectionHeading kicker="Graphics" title="What the numbers look like" sub="Hover any chart for exact values. Every HBA point links back to the report it came from." />
        <div className="grid gap-4 lg:grid-cols-2">
          <BlurFade inView className="rounded-2xl border bg-white p-5 lg:col-span-2 md:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">JCE vs the Government Reference Price (HBA), 2026</h3>
                <p className="mt-1 text-sm text-muted-foreground">6,322 GAR · USD/t. Gaps are periods not yet verified.</p>
              </div>
              <HbaLegend />
            </div>
            <div className="mt-4">
              <HbaChart hba={board.hba} jce={head ? { date: board.meta.assessmentDate, mid: head.mid, ref: head.ref } : null} />
            </div>
          </BlurFade>
          <BlurFade inView delay={0.05} className="rounded-2xl border bg-white p-5 md:p-6">
            <h3 className="text-lg font-bold">Indonesian GAR ladder</h3>
            <p className="mt-1 text-sm text-muted-foreground">Mid price by calorific value (kcal/kg GAR) with the assessed range. Hollow dots were reconstructed.</p>
            <div className="mt-4">
              <LadderChart ladder={board.ladder} />
            </div>
          </BlurFade>
          <BlurFade inView delay={0.1} className="rounded-2xl border bg-white p-5 md:p-6">
            <h3 className="text-lg font-bold">6,000 NAR across origins</h3>
            <p className="mt-1 text-sm text-muted-foreground">Mid price, USD/t, highest first.</p>
            <div className="mt-6">
              <OriginsChart data={nar6000(board).map((r) => ({ name: r.name, code: r.ref, mid: r.mid, low: r.low, high: r.high }))} />
            </div>
          </BlurFade>
        </div>
      </section>

      <section className="container-x pt-24">
        <SectionHeading
          kicker="AI insight"
          title="Brief, possibilities and checks"
          sub="Claude drafts the brief from the numbers above; rules check every figure before it goes live."
          action={
            <Link href="/insights" className={cn(buttonVariants({ variant: "outline" }), "bg-white")}>
              All insights <ArrowRight />
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <BlurFade inView><BriefCard board={board} className="h-full" /></BlurFade>
          <BlurFade inView delay={0.08}><PossibilityCard board={board} className="h-full" /></BlurFade>
        </div>
        <BlurFade inView className="mt-4">
          <ChecksList checks={checks} limit={6} showLink />
        </BlurFade>
      </section>

      <section className="container-x pt-24">
        <SectionHeading kicker="Proof" title="How every number is verified" sub="Collected automatically, read by AI, checked against each other, and approved by an editor." />
        <VerificationFlow />
        <div className="mt-12">
          <SourcesTable />
        </div>
      </section>

      <section className="container-x pt-24">
        <BlurFade inView className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8 md:p-12">
          <div className="bg-dots pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_left,#000,transparent_70%)]" />
          <div className="relative max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Better than a black-box guess.</h2>
            <p className="mt-3 text-muted-foreground">
              The international coal market deserves better than producer-owned price data and private pricing clubs. JCE is free to read — and will
              later evolve into a physical and derivative coal exchange.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/methodology" className={buttonVariants({ size: "lg" })}>Read the methodology</Link>
              <a href={`mailto:${board.settings.contactEmail}`} className={cn(buttonVariants({ size: "lg", variant: "outline" }), "bg-white")}>Contact us</a>
            </div>
          </div>
        </BlurFade>
      </section>
    </>
  );
}
