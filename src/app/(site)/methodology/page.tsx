import type { Metadata } from "next";
import { Building2, Scale, Sparkles, Users } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { PageHeader, SectionHeading } from "@/components/site/section";
import { SourcesTable } from "@/components/site/sources-table";
import { VerificationFlow } from "@/components/site/verification-flow";

export const metadata: Metadata = { title: "Methodology", description: "How Jakarta Coal Exchange assesses and verifies coal prices." };

const PILLARS = [
  { icon: Users, title: "No membership, no log-in", text: "The board is free to read. There is no subscription fee and no private pricing club." },
  { icon: Scale, title: "“Top & Tailed Mid of Mids”", text: "Sceats Coal Report’s disciplined methodology: extreme indications are removed before the mid of the remaining mids is assessed." },
  { icon: Sparkles, title: "AI-assisted, editor-approved", text: "Claude reads releases and drafts the brief. Nothing is published until an editor has seen every flag." },
  { icon: Building2, title: "Towards an exchange", text: "JCE will later evolve into a physical and derivative coal exchange." },
];

export default function MethodologyPage() {
  return (
    <>
      <PageHeader
        kicker="Methodology"
        title="Independent price discovery, with the proof attached"
        sub="Jakarta Coal Exchange is the international coal market’s platform for independent coal price discovery — owned by Sceats Coal Report."
      />
      <section className="container-x pt-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p, i) => (
            <BlurFade key={p.title} delay={i * 0.06} className="rounded-2xl border bg-white p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground"><p.icon className="size-5" /></span>
              <h3 className="mt-4 font-bold">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            </BlurFade>
          ))}
        </div>
        <BlurFade inView className="mt-10 max-w-3xl text-lg text-ink-soft">
          The international coal market deserves better than producer-owned and controlled price data, private pricing clubs and a journalist’s
          black-box guess at prices. Every JCE number carries its date, its range, and — for third-party benchmarks — a link to the report it came from.
        </BlurFade>
      </section>

      <section className="container-x pt-20">
        <SectionHeading kicker="Pipeline" title="From release to published price" />
        <VerificationFlow />
      </section>

      <section className="container-x pt-20">
        <SectionHeading kicker="Sources" title="What feeds the board" />
        <SourcesTable />
      </section>

      <section id="disclaimer" className="container-x scroll-mt-24 pt-20">
        <SectionHeading kicker="Legal" title="Disclaimer" />
        <div className="max-w-3xl space-y-4 rounded-2xl border bg-white p-6 text-sm leading-relaxed text-muted-foreground md:p-8">
          <p>Jakarta Coal Exchange (“JCE”) is a price discovery and market information platform owned by Sceats Coal Report. JCE is not currently an exchange, broker, trading venue, clearing house, investment adviser, commodity trading adviser or regulated financial services provider.</p>
          <p>The prices, curves, market indications and any other information published by JCE are provided for general market information and price discovery purposes. They do not constitute an offer, bid, recommendation, solicitation, benchmark administration service, investment advice, trading advice, legal advice or financial advice.</p>
          <p>JCE does not guarantee that any published price, indication, curve, assessment, counterparty name, specification, trade route or market comment is complete, accurate, current or suitable for any particular purpose. Users should make their own independent enquiries and should not rely on JCE as the sole basis for any commercial, trading, legal, financial or investment decision.</p>
          <p>Where JCE refers to companies, ports, origins, specifications, sanctions-sensitive jurisdictions, trade routes or counterparties, such references are for market identification purposes only and do not imply endorsement, approval, availability, tradability, creditworthiness, regulatory compliance or sanctions clearance.</p>
          <p>Third-party figures, including the HBA, are reproduced from the public sources linked on this site. AI-generated text is labelled as such and reviewed by an editor.</p>
          <p>To the fullest extent permitted by law, JCE, Sceats Coal Report and their directors, officers, employees, consultants and contributors accept no liability for any loss, damage, cost or expense arising from the use of, reliance on, or inability to use any information published by JCE.</p>
        </div>
      </section>
    </>
  );
}
