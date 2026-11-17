"use client";

import { CartesianGrid, ComposedChart, Line, ReferenceDot, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import type { HbaPoint } from "@/lib/types";
import { isConfirmed, sortedHba } from "@/lib/analytics";
import { fmtDate, signed, usd, utc } from "@/lib/format";
import { ChartTip } from "./chart-tip";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const STATUS: Record<HbaPoint["status"], string> = {
  official: "Official · Ministry release",
  corroborated: "Corroborated by 2+ outlets",
  single: "Single source",
  derived: "Derived from the next report",
  missing: "Not yet verified",
};

type Datum = { t: number; value: number | null; period: string; status: HbaPoint["status"]; nSources: number; date: string; prev: number | null };

export function HbaChart({ hba, jce, height = 340 }: { hba: HbaPoint[]; jce?: { date: string; mid: number; ref: string } | null; height?: number }) {
  const sorted = sortedHba(hba);
  const data: Datum[] = sorted.map((p, i) => ({
    t: utc(p.date),
    value: p.value,
    period: p.period,
    status: p.status,
    nSources: p.sources.length,
    date: p.date,
    prev: sorted[i - 1]?.value ?? null,
  }));
  const obs = data.filter((d) => d.value != null) as (Datum & { value: number })[];
  if (!obs.length) return null;
  const vals = [...obs.map((d) => d.value), ...(jce ? [jce.mid] : [])];
  const lo = Math.floor(Math.min(...vals) / 10) * 10, hi = Math.ceil(Math.max(...vals) / 10) * 10;
  const yTicks = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10);
  const t0 = data[0].t, t1 = data[data.length - 1].t;
  const start = new Date(t0), end = new Date(t1);
  const xTicks: number[] = [];
  for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d.getTime() <= t1; d.setUTCMonth(d.getUTCMonth() + 1)) xTicks.push(d.getTime());
  const peak = obs.reduce((a, d) => (d.value > a.value ? d : a));
  const last = obs[obs.length - 1];
  const jceT = jce ? utc(jce.date) : null;

  return (
    <ChartContainer config={{ value: { label: "HBA", color: "var(--hba)" } }} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ top: 28, right: 96, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[t0, t1]}
          ticks={xTicks}
          tickFormatter={(t: number) => MONTHS[new Date(t).getUTCMonth()]}
          tickLine={false}
          axisLine={{ stroke: "var(--axis)" }}
          tickMargin={8}
          interval="preserveStartEnd"
          minTickGap={18}
        />
        <YAxis domain={[lo, hi]} ticks={yTicks} tickLine={false} axisLine={false} width={40} tickMargin={6} />
        <Tooltip
          cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            const d = active && payload?.[0]?.payload as Datum | undefined;
            if (!d) return null;
            const rows = [
              d.value != null
                ? { color: "var(--hba)", value: usd(d.value), label: "HBA" + (d.prev != null ? `  ${signed(d.value - d.prev)}` : "") }
                : { value: "—", label: "HBA not yet verified" },
            ];
            if (jce && jce.date === d.date) rows.push({ color: "var(--jce)", value: usd(jce.mid), label: `JCE ${jce.ref}` });
            return <ChartTip title={`${d.period} · from ${fmtDate(d.date)}`} rows={rows} note={d.value != null ? `${STATUS[d.status]}${d.nSources ? ` · ${d.nSources} source${d.nSources > 1 ? "s" : ""}` : ""}` : undefined} />;
          }}
        />
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--hba)"
          strokeWidth={2}
          connectNulls={false}
          isAnimationActive
          animationDuration={1400}
          activeDot={{ r: 6, fill: "var(--hba)", stroke: "#fff", strokeWidth: 2 }}
          dot={(props: { cx?: number; cy?: number; payload?: Datum; index?: number }) => {
            const { cx, cy, payload, index } = props;
            if (cx == null || cy == null || !payload || payload.value == null) return <g key={`d-${index}`} />;
            const p = { status: payload.status } as HbaPoint;
            return isConfirmed(p) ? (
              <circle key={`d-${index}`} cx={cx} cy={cy} r={4} fill="var(--hba)" stroke="#fff" strokeWidth={2} />
            ) : (
              <circle key={`d-${index}`} cx={cx} cy={cy} r={3.5} fill="#fff" stroke="var(--hba)" strokeWidth={2} />
            );
          }}
        />
        <ReferenceDot x={peak.t} y={peak.value} r={0} label={{ value: `Peak ${usd(peak.value)}`, position: "top", offset: 12, fill: "var(--muted-foreground)", fontSize: 11 }} />
        <ReferenceDot x={last.t} y={last.value} r={0} label={{ value: `HBA ${usd(last.value)}`, position: "right", offset: 12, fill: "var(--foreground)", fontSize: 12, fontWeight: 700 }} />
        {jce && jceT != null && jceT >= t0 && jceT <= t1 && (
          <ReferenceDot
            x={jceT}
            y={jce.mid}
            r={6}
            fill="var(--jce)"
            stroke="#fff"
            strokeWidth={2}
            label={{ value: `JCE ${jce.ref} ${usd(jce.mid)}`, position: "bottom", offset: 12, fill: "var(--foreground)", fontSize: 12, fontWeight: 700 }}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

export function HbaLegend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 rounded bg-hba" />HBA · government reference</span>
      <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full border-2 border-hba bg-white" />Single source</span>
      <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-jce" />JCE assessment</span>
    </div>
  );
}
