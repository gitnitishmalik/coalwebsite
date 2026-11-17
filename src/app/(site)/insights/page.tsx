import type { Metadata } from "next";
import { BlurFade } from "@/components/ui/blur-fade";
import { BriefCard, ChecksList, PossibilityCard } from "@/components/site/insight-cards";
import { PageHeader } from "@/components/site/section";
import { getSiteData } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = { title: "AI insights", description: "AI market brief, possibility range and automated data checks for the JCE board." };

export default async function InsightsPage() {
  const { board, checks } = await getSiteData();
  return (
    <>
      <PageHeader
        kicker="AI insight"
        title="What the data says — and how sure we are"
        sub="Claude drafts the brief from the published numbers. The possibility range is computed from real HBA history. Rules check every figure before it is published."
      />
      <section className="container-x grid gap-4 pt-12 lg:grid-cols-[1.35fr_1fr]">
        <BlurFade><BriefCard board={board} className="h-full" /></BlurFade>
        <BlurFade delay={0.08}><PossibilityCard board={board} className="h-full" /></BlurFade>
      </section>
      <section className="container-x pt-4">
        <BlurFade inView><ChecksList checks={checks} /></BlurFade>
      </section>
    </>
  );
}
