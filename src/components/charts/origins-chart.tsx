"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { usd } from "@/lib/format";
import { ChartTip } from "./chart-tip";

/** Note: never name a field `ref` — Recharts spreads rows onto elements and React would treat it as a ref. */
type Datum = { name: string; code: string; mid: number; low: number; high: number };

export function OriginsChart({ data }: { data: Datum[] }) {
  const height = data.length * 40 + 36;
  return (
    <ChartContainer config={{ mid: { label: "Mid", color: "var(--jce)" } }} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, bottom: 0, left: 0 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} stroke="var(--grid)" />
        <XAxis type="number" domain={[0, "dataMax"]} tickLine={false} axisLine={false} tickMargin={6} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={128} tickLine={false} axisLine={{ stroke: "var(--axis)" }} tick={{ fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={({ active, payload }) => {
            const d = active && (payload?.[0]?.payload as Datum | undefined);
            if (!d) return null;
            const inverted = d.low > d.high;
            return (
              <ChartTip
                title={`${d.code} · ${d.name} · 6,000 NAR`}
                rows={[
                  { color: "var(--jce)", value: usd(d.mid), label: "mid" },
                  { value: `${usd(Math.min(d.low, d.high))} – ${usd(Math.max(d.low, d.high))}`, label: "range" },
                ]}
                note={inverted ? "Range inverted in the source — flagged for the editor" : undefined}
              />
            );
          }}
        />
        <Bar dataKey="mid" barSize={18} radius={[0, 4, 4, 0]} isAnimationActive animationDuration={1000}>
          {data.map((d) => (
            <Cell key={d.code} fill="var(--jce)" fillOpacity={d.low > d.high ? 0.4 : 1} />
          ))}
          <LabelList dataKey="mid" position="right" offset={8} formatter={(v) => usd(Number(v))} className="fill-foreground text-xs font-semibold" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
