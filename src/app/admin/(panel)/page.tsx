import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CircleDashed, FileClock, ImageUp, Landmark, Rocket, Sparkles } from "lucide-react";
import { AskAi } from "@/components/admin/ask-ai";
import { ActivityFeed, LiveRefresh } from "@/components/admin/live";
import { MarketExplorer } from "@/components/admin/market-explorer";
import { AdminTitle, Panel } from "@/components/admin/page-title";
import { HbaExplorer } from "@/components/charts/hba-explorer";
import { ChecksList } from "@/components/site/insight-cards";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { buttonVariants } from "@/components/ui/button";
import { aiEnabled, MODELS } from "@/lib/ai";
import { allRows, headline } from "@/lib/analytics";
import { currentAdmin } from "@/lib/auth";
import { checkCounts, runChecks } from "@/lib/checks";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { getUsdIdr } from "@/lib/fx";
import { blobEnabled, getAudit, getDraft, getHistory, getPending, getPublished, storeMode } from "@/lib/store";
import { cn } from "@/lib/utils";

export const maxDuration = 120;

export default async function Dashboard() {
  const [me, { board: draft, isDraft }, published, history, audit, pending, fx] = await Promise.all([
    currentAdmin(),
    getDraft(),
    getPublished(),
    getHistory(),
    getAudit(),
    getPending(),
    getUsdIdr(),
  ]);
  const checks = runChecks(draft);
  const c = checkCounts(checks);
  const pubRows = new Map(allRows(published).map((r) => [r.ref, r]));
  const changed = allRows(draft).filter((r) => {
    const p = pubRows.get(r.ref);
    return !p || p.mid !== r.mid || p.low !== r.low || p.high !== r.high;
  }).length;
  const mode = storeMode();
  const hour = (new Date().getUTCHours() + 7) % 24; // Jakarta
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const head = headline(published);
  const aiOn = aiEnabled();

  const stats = [
    { label: "Live version", value: published.meta.version, foot: published.meta.publishedAt ? `Published ${fmtDateTime(published.meta.publishedAt)}` : "Seed data — not yet published from admin", icon: Rocket, href: "/" },
    { label: "Draft changes", value: isDraft ? changed : 0, foot: isDraft ? "prices differ from live" : "No draft open", icon: FileClock, href: "/admin/prices" },
    { label: "Issues to review", value: c.critical + c.warning, foot: `${c.critical} critical · ${c.warning} warnings`, icon: CircleDashed, href: "/admin/prices" },
    { label: "HBA awaiting approval", value: pending.length, foot: "found by the news monitor", icon: Landmark, href: "/admin/benchmarks" },
  ];

  const system = [
    { ok: mode !== "readonly", label: "Database", detail: mode === "redis" ? "Upstash Redis" : mode === "file" ? "Local files (.data)" : "Not connected — read-only" },
    { ok: blobEnabled() || mode === "file", label: "File storage", detail: blobEnabled() ? "Vercel Blob" : mode === "file" ? "public/uploads" : "Not connected" },
    { ok: aiOn, label: "NVIDIA AI", detail: aiOn ? MODELS.reasoning.split("/")[1] : "Add NVIDIA_API_KEY" },
    { ok: Boolean(process.env.CRON_SECRET), label: "Daily HBA news monitor", detail: process.env.CRON_SECRET ? "Scheduled 02:00 UTC" : "Add CRON_SECRET" },
  ];

  return (
    <>
      <AdminTitle title={`${greet}, ${me?.user ?? "Editor"}`} sub={`Live assessment ${fmtDate(published.meta.assessmentDate)} · next update ${fmtDate(published.meta.nextUpdate)}`}>
        <div className="flex flex-wrap items-center gap-2">
          <LiveRefresh />
          <Link href="/admin/upload" className={buttonVariants({ size: "lg" })}>
            <ImageUp /> Upload & analyse
          </Link>
        </div>
      </AdminTitle>

      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s, i) => (
            <BlurFade key={s.label} delay={i * 0.05}>
              <Link href={s.href} className="group block rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-24px_rgba(15,23,42,.35)]">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  {s.label}
                  <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground transition-transform group-hover:scale-110"><s.icon className="size-4" /></span>
                </div>
                <NumberTicker value={s.value} className="mt-2 text-3xl font-bold tracking-tight text-foreground" />
                <div className="mt-1 text-xs text-muted-foreground">{s.foot}</div>
              </Link>
            </BlurFade>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Panel
            title="Ask the data"
            sub={aiOn ? `Streams from ${MODELS.reasoning.split("/")[1]} · answers only from your data · every figure checked` : "Add NVIDIA_API_KEY to enable"}
            action={<span className="hidden items-center gap-1 rounded-full bg-accent px-2 py-0.5 font-mono text-[10px] font-bold text-accent-foreground sm:inline-flex"><Sparkles className="size-3" /> AI</span>}
          >
            <AskAi aiOn={aiOn} />
          </Panel>
          <Panel title="Quick actions" sub="Or press Ctrl K anywhere">
            <div className="grid gap-2">
              {[
                { href: "/admin/upload", icon: ImageUp, t: "Upload & analyse with AI", d: "Image, Excel, PDF or CSV — AI extracts prices, compares them and writes a summary." },
                { href: "/admin/benchmarks", icon: Bot, t: "Find new HBA releases", d: "Checks the news and groups outlets that agree — no AI guessing." },
                { href: "/admin/insights", icon: Sparkles, t: "Draft the market brief", d: "Generate from the current numbers, edit, approve." },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="group flex items-start gap-3 rounded-xl border p-3 transition hover:border-primary/40 hover:bg-accent/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><a.icon className="size-4" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-semibold">{a.t} <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span>
                    <span className="text-xs text-muted-foreground">{a.d}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Market explorer" sub={`Live board · ${fmtDate(published.meta.assessmentDate)} · filter, rank and click any assessment`}>
          <MarketExplorer regions={published.regions} history={history} fxRate={fx.rate} />
        </Panel>

        <Panel title="HBA explorer" sub="Government reference price, 6,322 GAR — choose a range, filter to confirmed values, or drag to zoom">
          <HbaExplorer hba={published.hba} jce={head ? { date: published.meta.assessmentDate, mid: head.mid, ref: head.ref } : null} />
        </Panel>

        <ChecksList checks={checks} limit={8} />

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="System status">
            <ul className="divide-y">
              {system.map((s) => (
                <li key={s.label} className="flex items-center gap-3 py-2.5 text-sm">
                  {s.ok ? <CheckCircle2 className="size-4 text-good" /> : <CircleDashed className="size-4 text-warning" />}
                  <span className="font-medium">{s.label}</span>
                  <span className={cn("ml-auto text-right text-xs", s.ok ? "text-muted-foreground" : "text-warning")}>{s.detail}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Recent activity">
            <ActivityFeed items={audit} />
          </Panel>
        </div>
      </div>
    </>
  );
}
