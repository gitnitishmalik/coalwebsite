"use client";

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { ChartTip } from "@/components/charts/chart-tip";
import { fmtDate, usd } from "@/lib/format";
import type { HistoryEntry } from "@/lib/types";

export function HistoryChart({ history, refKey = "SCR#1" }: { history: HistoryEntry[]; refKey?: string }) {
  const data = [...history]
    .reverse()
    .filter((h) => h.prices[refKey] != null)
    .map((h) => ({ v: h.version, date: h.assessmentDate, price: h.prices[refKey] }));
  if (data.length < 2)
    return (
      <div className="grid h-48 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
        <p>
          The {refKey} history builds up with every publish.
          <br />
          {data.length ? "One version published so far." : "Nothing published from the admin yet."}
        </p>
      </div>
    );
  return (
    <ChartContainer config={{ price: { label: refKey, color: "var(--jce)" } }} className="aspect-auto h-56 w-full">
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="date" tickFormatter={(d: string) => fmtDate(d, { day: "2-digit", month: "short" })} tickLine={false} axisLine={{ stroke: "var(--axis)" }} tickMargin={8} />
        <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          cursor={{ stroke: "var(--axis)" }}
          content={({ active, payload }) => {
            const d = active && (payload?.[0]?.payload as (typeof data)[number] | undefined);
            return d ? <ChartTip title={`v${d.v} · ${fmtDate(d.date)}`} rows={[{ color: "var(--jce)", value: usd(d.price), label: refKey }]} /> : null;
          }}
        />
        <Line dataKey="price" stroke="var(--jce)" strokeWidth={2} dot={{ r: 4, fill: "var(--jce)", stroke: "#fff", strokeWidth: 2 }} type="linear" />
      </LineChart>
    </ChartContainer>
  );
}
