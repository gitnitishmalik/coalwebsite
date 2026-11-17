"use client";

import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import type { LadderPoint } from "@/lib/types";
import { num, usd } from "@/lib/format";
import { ChartTip } from "./chart-tip";

/** `ref` is renamed to `anchor`: Recharts spreads rows onto elements and React would treat `ref` as a ref. */
type Datum = Omit<LadderPoint, "ref"> & { anchor: string | null; range: [number, number] };

export function LadderChart({ ladder, height = 320 }: { ladder: LadderPoint[]; height?: number }) {
  const data: Datum[] = [...ladder].sort((a, b) => a.spec - b.spec).map(({ ref, ...p }) => ({ ...p, anchor: ref ?? null, range: [p.low, p.high] as [number, number] }));
  if (data.length < 2) return null;
  const lo = Math.floor(Math.min(...data.map((d) => d.low)) / 20) * 20;
  const hi = Math.ceil(Math.max(...data.map((d) => d.high)) / 20) * 20;
  const minX = data[0].spec, maxX = data[data.length - 1].spec;
  const xTicks = [3500, 4000, 4500, 5000, 5500, 6000].filter((t) => t >= minX && t <= maxX);

  return (
    <ChartContainer config={{ mid: { label: "Mid", color: "var(--jce)" } }} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={data} margin={{ top: 26, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="spec" type="number" domain={[minX, maxX]} ticks={xTicks} tickFormatter={(v: number) => num(v)} tickLine={false} axisLine={{ stroke: "var(--axis)" }} tickMargin={8} />
        <YAxis domain={[lo, hi]} tickLine={false} axisLine={false} width={40} tickMargin={6} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            const d = active && (payload?.[0]?.payload as Datum | undefined);
            if (!d) return null;
            return (
              <ChartTip
                title={`${num(d.spec)} GAR${d.anchor ? ` · ${d.anchor}` : ""}`}
                rows={[
                  { color: "var(--jce)", value: usd(d.mid), label: "mid" },
                  { value: `${usd(d.low)} – ${usd(d.high)}`, label: "range" },
                ]}
                note={d.reconstructed ? "Unreadable in the source — reconstructed from the published range" : undefined}
              />
            );
          }}
        />
        <Area dataKey="range" type="linear" stroke="none" fill="var(--jce)" fillOpacity={0.12} isAnimationActive animationDuration={1200} activeDot={false} />
        <Line
          dataKey="mid"
          type="linear"
          stroke="var(--jce)"
          strokeWidth={2}
          isAnimationActive
          animationDuration={1200}
          activeDot={{ r: 5, fill: "var(--jce)", stroke: "#fff", strokeWidth: 2 }}
          dot={(props: { cx?: number; cy?: number; payload?: Datum; index?: number }) => {
            const { cx, cy, payload, index } = props;
            if (cx == null || cy == null || !payload) return <g key={`l-${index}`} />;
            const anchor = payload.spec === minX ? "start" : payload.spec === maxX ? "end" : "middle";
            return (
              <g key={`l-${index}`}>
                {payload.reconstructed ? (
                  <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="var(--jce)" strokeWidth={2} />
                ) : payload.anchor ? (
                  <circle cx={cx} cy={cy} r={5} fill="var(--jce)" stroke="#fff" strokeWidth={2} />
                ) : null}
                {payload.anchor && (
                  <text x={cx} y={cy - 12} textAnchor={anchor} fontSize={11} fontWeight={700} fill="var(--foreground)">
                    {payload.anchor}
                  </text>
                )}
              </g>
            );
          }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
