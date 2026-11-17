"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Brush, CartesianGrid, ComposedChart, Line, ReferenceDot, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { NumberTicker } from "@/components/ui/number-ticker";
import type { HbaPoint } from "@/lib/types";
import { isConfirmed, sortedHba } from "@/lib/analytics";
import { fmtDate, signed, usd, utc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartTip } from "./chart-tip";

type Span = "3M" | "6M" | "YTD" | "ALL";
type Datum = { t: number; value: number | null; period: string; status: HbaPoint["status"]; n: number; date: string };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** HBA chart with range presets, a confirmed-only filter, a zoom brush and live stats for the slice. */
export function HbaExplorer({ hba, jce, height = 340 }: { hba: HbaPoint[]; jce?: { date: string; mid: number; ref: string } | null; height?: number }) {
  const [span, setSpan] = useState<Span>("ALL");
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [showJce, setShowJce] = useState(true);
  // Zoom window from the brush (data indexes). null = whole range.
  const [win, setWin] = useState<{ startIndex: number; endIndex: number } | null>(null);

  const all: Datum[] = useMemo(
    () => sortedHba(hba).map((p) => ({ t: utc(p.date), value: p.value, period: p.period, status: p.status, n: p.sources.length, date: p.date })),
    [hba],
  );
  const lastT = all.length ? all[all.length - 1].t : 0; // no data → nothing to filter
  const from =
    span === "ALL" ? -Infinity : span === "YTD" ? Date.UTC(new Date(lastT).getUTCFullYear(), 0, 1) : lastT - (span === "3M" ? 92 : 183) * 86_400_000;
  // Memoised: Recharts resets the brush's end index whenever it receives a new data array.
  const data = useMemo(
    () =>
      all
        .filter((d) => d.t >= from)
        .map((d) => ({ ...d, value: confirmedOnly && !isConfirmed({ status: d.status } as HbaPoint) ? null : d.value })),
    [all, from, confirmedOnly],
  );
  const obs = data.filter((d) => d.value != null) as (Datum & { value: number })[];

  // Stats describe what is on screen: the preset range, narrowed further by the brush.
  const view = win ? data.slice(win.startIndex, win.endIndex + 1) : data;
  const viewObs = view.filter((d) => d.value != null) as (Datum & { value: number })[];
  const stats = viewObs.length
    ? (() => {
        const first = viewObs[0], last = viewObs[viewObs.length - 1];
        const vals = viewObs.map((d) => d.value);
        let ups = 0, downs = 0;
        for (let i = 1; i < view.length; i++) {
          const a = view[i - 1].value, b = view[i].value;
          if (a == null || b == null) continue;
          if (b > a) ups++;
          else if (b < a) downs++;
        }
        return { change: last.value - first.value, pct: ((last.value - first.value) / first.value) * 100, high: Math.max(...vals), low: Math.min(...vals), avg: vals.reduce((s, v) => s + v, 0) / vals.length, ups, downs, first, last };
      })()
    : null;

  // Y axis: an even step (1/2/5/10/20/25/50) so ticks never bunch up at the top.
  const vals = [...obs.map((d) => d.value), ...(showJce && jce ? [jce.mid] : [])];
  const vMin = vals.length ? Math.min(...vals) : 0;
  const vMax = vals.length ? Math.max(...vals) : 10;
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((s) => s >= Math.max(vMax - vMin, 4) / 4) ?? 100;
  const lo = Math.floor((vMin - step / 4) / step) * step;
  const hi = Math.ceil((vMax + step / 4) / step) * step;
  const yTicks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

  // X axis: one tick per calendar month (two HBA periods share a month, so data-point ticks repeated labels).
  const xTicks: number[] = [];
  if (data.length) {
    const end = data[data.length - 1].t;
    for (let d = new Date(data[0].t); d.getTime() <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      const m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
      if (m >= data[0].t) xTicks.push(m);
    }
  }
  const multiYear = data.length > 0 && new Date(data[0].t).getUTCFullYear() !== new Date(data[data.length - 1].t).getUTCFullYear();
  const monthLabel = (t: number) => {
    const d = new Date(t);
    return d.getUTCMonth() === 0 && multiYear ? `Jan ’${String(d.getUTCFullYear()).slice(2)}` : MONTHS[d.getUTCMonth()];
  };
  const jceT = jce ? utc(jce.date) : null;
  const jceVisible = showJce && jce && jceT != null && data.length > 0 && jceT >= data[0].t && jceT <= data[data.length - 1].t;

  const pill = (active: boolean) => cn("relative rounded-lg px-3 py-1.5 text-xs font-semibold", active ? "text-foreground" : "text-muted-foreground hover:text-foreground");

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["3M", "6M", "YTD", "ALL"] as Span[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSpan(s);
                setWin(null);
              }}
              className={pill(span === s)}
            >
              {span === s && <motion.span layoutId={`hba-span-${height}`} className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span className="relative">{s === "ALL" ? "All" : s}</span>
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={confirmedOnly}
            onChange={(e) => {
              setConfirmedOnly(e.target.checked);
              setWin(null);
            }}
            className="size-4 accent-[var(--hba)]"
          />
          Confirmed values only
        </label>
        {jce && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={showJce} onChange={(e) => setShowJce(e.target.checked)} className="size-4 accent-[var(--jce)]" />
            Show JCE {jce.ref}
          </label>
        )}
      </div>

      {stats && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { l: `Change ${stats.first.period} → ${stats.last.period}`, v: stats.change, signedV: true, tone: stats.change < 0 ? "text-down" : "text-up" },
            { l: "High", v: stats.high },
            { l: "Low", v: stats.low },
            { l: "Average", v: stats.avg },
            { l: "Rises / falls", text: `${stats.ups} / ${stats.downs}` },
          ].map((s) => (
            <div key={s.l} className="rounded-xl bg-muted/50 p-3">
              <div className="truncate text-[11px] text-muted-foreground">{s.l}</div>
              <div className={cn("mt-0.5 text-lg font-bold tracking-tight", s.tone)}>
                {s.text ?? (
                  <>
                    {s.signedV ? (s.v! < 0 ? "−" : "+") : ""}$
                    <NumberTicker key={`${s.l}-${span}-${confirmedOnly}`} value={Math.abs(s.v!)} decimalPlaces={2} className={cn("text-foreground", s.tone)} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ChartContainer config={{ value: { label: "HBA", color: "var(--hba)" } }} className="mt-4 aspect-auto w-full" style={{ height }}>
        {/* Remount on range/filter change so the brush starts from the full range again. */}
        <ComposedChart key={`${span}-${confirmedOnly}`} data={data} margin={{ top: 24, right: 44, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} ticks={xTicks} tickFormatter={monthLabel} tickLine={false} axisLine={{ stroke: "var(--axis)" }} tickMargin={8} minTickGap={16} />
          <YAxis domain={[lo, hi]} ticks={yTicks} tickLine={false} axisLine={false} width={40} tickMargin={6} allowDecimals={false} />
          <Tooltip
            cursor={{ stroke: "var(--axis)" }}
            content={({ active, payload }) => {
              const d = active && (payload?.[0]?.payload as Datum | undefined);
              if (!d) return null;
              const i = all.findIndex((x) => x.t === d.t);
              const prev = all[i - 1]?.value;
              const rows = [d.value != null ? { color: "var(--hba)", value: usd(d.value), label: "HBA" + (prev != null ? `  ${signed(d.value - prev)}` : "") } : { value: "—", label: "not verified / filtered" }];
              if (showJce && jce && jce.date === d.date) rows.push({ color: "var(--jce)", value: usd(jce.mid), label: `JCE ${jce.ref}` });
              return <ChartTip title={`${d.period} · from ${fmtDate(d.date)}`} rows={rows} note={d.n ? `${d.status} · ${d.n} source${d.n > 1 ? "s" : ""}` : undefined} />;
            }}
          />
          <Line
            dataKey="value"
            type="linear"
            stroke="var(--hba)"
            strokeWidth={2}
            connectNulls={false}
            animationDuration={700}
            activeDot={{ r: 6, fill: "var(--hba)", stroke: "#fff", strokeWidth: 2 }}
            dot={(p: { cx?: number; cy?: number; payload?: Datum; index?: number }) =>
              p.cx == null || p.cy == null || !p.payload || p.payload.value == null ? (
                <g key={`e-${p.index}`} />
              ) : isConfirmed({ status: p.payload.status } as HbaPoint) ? (
                <circle key={`d-${p.index}`} cx={p.cx} cy={p.cy} r={4} fill="var(--hba)" stroke="#fff" strokeWidth={2} />
              ) : (
                <circle key={`d-${p.index}`} cx={p.cx} cy={p.cy} r={3.5} fill="#fff" stroke="var(--hba)" strokeWidth={2} />
              )
            }
          />
          {jceVisible && <ReferenceDot x={jceT!} y={jce!.mid} r={6} fill="var(--jce)" stroke="#fff" strokeWidth={2} label={{ value: `JCE ${usd(jce!.mid)}`, position: "bottom", offset: 10, fill: "var(--foreground)", fontSize: 11, fontWeight: 700 }} />}
          {data.length > 4 && <Brush dataKey="t" height={22} travellerWidth={8} stroke="var(--hba)" fill="var(--muted)" onChange={(r) => r.startIndex != null && r.endIndex != null && setWin(r.startIndex === 0 && r.endIndex === data.length - 1 ? null : { startIndex: r.startIndex, endIndex: r.endIndex })} tickFormatter={(t: number) => fmtDate(new Date(t).toISOString().slice(0, 10), { day: "2-digit", month: "short" })} />}
        </ComposedChart>
      </ChartContainer>
      <p className="mt-2 text-[11px] text-muted-foreground">Drag the handles under the chart to zoom. Hollow dots rely on one source.</p>
    </div>
  );
}
