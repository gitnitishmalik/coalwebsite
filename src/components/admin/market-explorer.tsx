"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, MousePointerClick, Sparkles, TriangleAlert } from "lucide-react";
import { ChartContainer } from "@/components/ui/chart";
import { NumberTicker } from "@/components/ui/number-ticker";
import { ChartTip } from "@/components/charts/chart-tip";
import { RangeBar } from "@/components/site/range-bar";
import { fmtDate, idrCompact, num, usd } from "@/lib/format";
import type { HistoryEntry, Region } from "@/lib/types";
import { cn } from "@/lib/utils";
import { openAssistant } from "./command-center";

type Metric = "mid" | "width";
type Row = { code: string; name: string; region: string; basis: string; spec: number; mid: number; low: number; high: number; width: number; bad: boolean };

/** Interactive board explorer: filter, rank, click a bar for details and history. */
export function MarketExplorer({ regions, history, fxRate }: { regions: Region[]; history: HistoryEntry[]; fxRate: number }) {
  const [region, setRegion] = useState("all");
  const [basis, setBasis] = useState<"all" | "GAR" | "NAR">("all");
  const [metric, setMetric] = useState<Metric>("mid");
  const [selected, setSelected] = useState<string | null>(null);

  const all: Row[] = useMemo(
    () =>
      regions.flatMap((r) =>
        r.rows.map((row) => {
          const lo = Math.min(row.low, row.high), hi = Math.max(row.low, row.high);
          return {
            code: row.ref,
            name: `${row.ref} · ${r.id === "indonesia" || r.id === "south-america" ? row.origin : `${r.label} ${row.origin}`}`,
            region: r.id,
            basis: r.basis,
            spec: row.spec,
            mid: row.mid,
            low: row.low,
            high: row.high,
            width: Number((((hi - lo) / 2 / row.mid) * 100).toFixed(2)),
            bad: row.low > row.high,
          };
        }),
      ),
    [regions],
  );
  const rows = all.filter((r) => (region === "all" || r.region === region) && (basis === "all" || r.basis === basis)).sort((a, b) => b[metric] - a[metric]);
  const avg = rows.length ? rows.reduce((s, r) => s + r.mid, 0) / rows.length : 0;
  const sel = rows.find((r) => r.code === selected) ?? null;
  const trend = sel
    ? [...history].reverse().filter((h) => h.prices[sel.code] != null).map((h) => ({ v: h.version, date: h.assessmentDate, price: h.prices[sel.code] }))
    : [];
  const height = Math.max(160, rows.length * 30 + 30);

  const chip = (active: boolean) => cn("relative rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", active ? "text-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <div>
      {/* Filters — one row, scoping everything below */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
          {[{ id: "all", label: "All regions" }, ...regions.map((r) => ({ id: r.id, label: r.label }))].map((t) => (
            <button key={t.id} type="button" onClick={() => setRegion(t.id)} className={chip(region === t.id)}>
              {region === t.id && <motion.span layoutId="mx-region" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["all", "GAR", "NAR"] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBasis(b)} className={chip(basis === b)}>
              {basis === b && <motion.span layoutId="mx-basis" className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
              <span className="relative">{b === "all" ? "Any basis" : b}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1 rounded-xl bg-muted p-1">
          {([["mid", "Mid price"], ["width", "Range width"]] as const).map(([m, l]) => (
            <button key={m} type="button" onClick={() => setMetric(m)} className={chip(metric === m)}>
              {metric === m && <motion.span layoutId="mx-metric" className="absolute inset-0 rounded-lg bg-white shadow-sm" />}
              <span className="relative">{l}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary for the current slice */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { l: "Assessments", v: rows.length, d: 0, p: "" },
          { l: "Average mid", v: avg, d: 2, p: "$" },
          { l: "Highest", v: rows.length ? Math.max(...rows.map((r) => r.mid)) : 0, d: 2, p: "$" },
          { l: "Lowest", v: rows.length ? Math.min(...rows.map((r) => r.mid)) : 0, d: 2, p: "$" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl bg-muted/50 p-3">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="mt-0.5 text-xl font-bold tracking-tight">
              {s.p}
              <NumberTicker key={`${s.l}-${region}-${basis}`} value={s.v} decimalPlaces={s.d} className="text-foreground" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointerClick className="size-3.5" /> Click a bar for details
          </div>
          <ChartContainer config={{ v: { label: metric === "mid" ? "Mid" : "Range ±%", color: "var(--jce)" } }} className="aspect-auto w-full" style={{ height }}>
            <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 0 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke="var(--grid)" />
              <XAxis type="number" tickLine={false} axisLine={false} tickMargin={6} domain={[0, "dataMax"]} allowDecimals={metric === "width"} />
              <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={{ stroke: "var(--axis)" }} tick={{ fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={({ active, payload }) => {
                  const d = active && (payload?.[0]?.payload as Row | undefined);
                  if (!d) return null;
                  return <ChartTip title={`${d.name} · ${num(d.spec)} ${d.basis}`} rows={[{ color: "var(--jce)", value: usd(d.mid), label: "mid" }, { value: `±${d.width}%`, label: "range" }]} note="Click for details" />;
                }}
              />
              <Bar dataKey={metric} barSize={16} radius={[0, 4, 4, 0]} onClick={(d) => setSelected((d as unknown as { payload: Row }).payload?.code ?? null)} className="cursor-pointer" animationDuration={600}>
                {rows.map((r) => (
                  <Cell key={r.code} fill={r.bad ? "var(--critical)" : "var(--jce)"} fillOpacity={selected && selected !== r.code ? 0.35 : 1} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        <div className="rounded-xl border p-4">
          <AnimatePresence mode="wait">
            {sel ? (
              <motion.div key={sel.code} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-semibold text-primary">{sel.code}</div>
                    <div className="font-semibold">{sel.name.split(" · ")[1]}</div>
                    <div className="text-xs text-muted-foreground">{num(sel.spec)} {sel.basis}</div>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                </div>
                <div className="mt-3 text-3xl font-bold tracking-tight">{usd(sel.mid)}<span className="text-base font-medium text-muted-foreground">/t</span></div>
                <div className="mt-2 flex items-center gap-3">
                  <RangeBar mid={sel.mid} low={sel.low} high={sel.high} className="w-36" />
                  <span className="tnum text-xs text-muted-foreground">{usd(sel.low)} – {usd(sel.high)}</span>
                </div>
                {sel.bad && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-critical"><TriangleAlert className="size-3.5" /> Range is inverted in the source</p>}
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">In rupiah</dt><dd className="tnum font-semibold">{idrCompact(sel.mid, fxRate)}</dd></div>
                  <div>
                    <dt className="text-xs text-muted-foreground">vs slice average</dt>
                    <dd className={cn("tnum inline-flex items-center gap-0.5 font-semibold", sel.mid >= avg ? "text-up" : "text-down")}>
                      {sel.mid >= avg ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                      {(((sel.mid - avg) / avg) * 100).toFixed(1)}%
                    </dd>
                  </div>
                  <div><dt className="text-xs text-muted-foreground">Rank</dt><dd className="font-semibold">{rows.findIndex((r) => r.code === sel.code) + 1} of {rows.length}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Range</dt><dd className="font-semibold">±{sel.width}%</dd></div>
                </dl>
                <div className="mt-4">
                  <div className="text-xs text-muted-foreground">History across published versions</div>
                  {trend.length > 1 ? (
                    <ChartContainer config={{ price: { label: sel.code, color: "var(--jce)" } }} className="mt-1 aspect-auto h-28 w-full">
                      <LineChart data={trend} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={["auto", "auto"]} hide />
                        <Tooltip content={({ active, payload }) => { const d = active && (payload?.[0]?.payload as (typeof trend)[number] | undefined); return d ? <ChartTip title={`v${d.v} · ${fmtDate(d.date)}`} rows={[{ color: "var(--jce)", value: usd(d.price), label: sel.code }]} /> : null; }} />
                        <Line dataKey="price" stroke="var(--jce)" strokeWidth={2} dot={{ r: 3, fill: "var(--jce)", stroke: "#fff", strokeWidth: 2 }} />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">Builds up with each publish.</p>
                  )}
                </div>
                <button type="button" onClick={() => openAssistant(`Tell me about ${sel.code} (${sel.name.split(" · ")[1]} ${sel.spec} ${sel.basis}): its price, range and how it compares with the rest of the board.`)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                  <Sparkles className="size-4" /> Ask AI about {sel.code}
                </button>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid h-full min-h-48 place-items-center text-center text-sm text-muted-foreground">
                <div>
                  <MousePointerClick className="mx-auto mb-2 size-6 text-primary" />
                  Select a bar to see the assessment’s range, rupiah value, rank and history.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
