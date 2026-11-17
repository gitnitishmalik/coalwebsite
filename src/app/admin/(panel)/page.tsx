import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CircleDashed, FileClock, ImageUp, Landmark, Rocket, Sparkles } from "lucide-react";
import { HistoryChart } from "@/components/admin/history-chart";
import { AdminTitle, Panel } from "@/components/admin/page-title";
import { ChecksList } from "@/components/site/insight-cards";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";
import { buttonVariants } from "@/components/ui/button";
import { aiEnabled, MODELS } from "@/lib/ai";
import { allRows } from "@/lib/analytics";
import { currentAdmin } from "@/lib/auth";
import { checkCounts, runChecks } from "@/lib/checks";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { blobEnabled, getAudit, getDraft, getHistory, getPending, getPublished, storeMode } from "@/lib/store";
import { cn } from "@/lib/utils";

export default async function Dashboard() {
  const [me, { board: draft, isDraft }, published, history, audit, pending] = await Promise.all([
    currentAdmin(),
    getDraft(),
    getPublished(),
    getHistory(),
    getAudit(),
    getPending(),
  ]);
  const checks = runChecks(draft);
  const c = checkCounts(checks);
  const pubRows = new Map(allRows(published).map((r) => [r.ref, r]));
  const changed = allRows(draft).filter((r) => {
    const p = pubRows.get(r.ref);
    return !p || p.mid !== r.mid || p.low !== r.low || p.high !== r.high;
  }).length;
  const mode = storeMode();
  const hour = new Date().getUTCHours() + 7; // Jakarta
  const greet = hour % 24 < 12 ? "Good morning" : hour % 24 < 18 ? "Good afternoon" : "Good evening";

  const stats = [
    { label: "Live version", value: published.meta.version, foot: published.meta.publishedAt ? `Published ${fmtDateTime(published.meta.publishedAt)}` : "Seed data — not yet published from admin", icon: Rocket },
    { label: "Draft changes", value: isDraft ? changed : 0, foot: isDraft ? "prices differ from live" : "No draft open", icon: FileClock },
    { label: "Issues to review", value: c.critical + c.warning, foot: `${c.critical} critical · ${c.warning} warnings`, icon: CircleDashed },
    { label: "HBA awaiting approval", value: pending.length, foot: "found by AI search", icon: Landmark },
  ];

  const system = [
    { ok: mode !== "readonly", label: "Database", detail: mode === "redis" ? "Upstash Redis" : mode === "file" ? "Local files (.data)" : "Not connected — read-only" },
    { ok: blobEnabled() || mode === "file", label: "Image storage", detail: blobEnabled() ? "Vercel Blob" : mode === "file" ? "public/uploads" : "Not connected" },
    { ok: aiEnabled(), label: "NVIDIA AI", detail: aiEnabled() ? MODELS.reasoning.split("/")[1] : "Add NVIDIA_API_KEY" },
    { ok: Boolean(process.env.CRON_SECRET), label: "Daily HBA news monitor", detail: process.env.CRON_SECRET ? "Scheduled 02:00 UTC" : "Add CRON_SECRET" },
  ];

  return (
    <>
      <AdminTitle title={`${greet}, ${me?.user ?? "Editor"}`} sub={`Live assessment ${fmtDate(published.meta.assessmentDate)} · next update ${fmtDate(published.meta.nextUpdate)}`}>
        <Link href="/admin/upload" className={buttonVariants({ size: "lg" })}>
          <ImageUp /> Upload new board
        </Link>
      </AdminTitle>

      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((s, i) => (
            <BlurFade key={s.label} delay={i * 0.05} className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                {s.label}
                <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground"><s.icon className="size-4" /></span>
              </div>
              <NumberTicker value={s.value} className="mt-2 text-3xl font-bold tracking-tight text-foreground" />
              <div className="mt-1 text-xs text-muted-foreground">{s.foot}</div>
            </BlurFade>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Panel title="SCR#1 across published versions" sub="Indonesia 6,322 GAR mid, USD/t">
            <HistoryChart history={history} />
          </Panel>
          <Panel title="Quick actions">
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
            {audit.length ? (
              <ul className="max-h-72 divide-y overflow-auto">
                {audit.slice(0, 20).map((a, i) => (
                  <li key={i} className="flex gap-3 py-2.5 text-sm">
                    <span className="w-36 shrink-0 text-xs text-muted-foreground">{fmtDateTime(a.at)}</span>
                    <span>
                      <span className="font-medium">{a.action}</span>
                      {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
