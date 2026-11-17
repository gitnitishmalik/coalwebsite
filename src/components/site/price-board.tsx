"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownUp, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Region } from "@/lib/types";
import { halfWidthPct } from "@/lib/analytics";
import { idrCompact, num, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RangeBar } from "./range-bar";
import { StatusIcon } from "./status-icon";

type SortKey = "board" | "mid-desc" | "mid-asc";

export function PriceBoard({ regions, fxRate, assessmentDate, compact = false }: { regions: Region[]; fxRate: number; assessmentDate: string; compact?: boolean }) {
  const [region, setRegion] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("board");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let out = regions
      .filter((r) => region === "all" || r.id === region)
      .flatMap((r) => r.rows.map((row) => ({ ...row, region: r })))
      .filter((r) => !term || `${r.ref} ${r.origin} ${r.region.label} ${r.spec} ${r.region.basis}`.toLowerCase().includes(term));
    if (sort !== "board") out = [...out].sort((a, b) => (sort === "mid-desc" ? b.mid - a.mid : a.mid - b.mid));
    return out;
  }, [regions, region, q, sort]);

  function exportCsv() {
    const head = ["ref", "region", "origin", "spec", "basis", "mid_usd", "low_usd", "high_usd", "assessment_date"];
    const lines = rows.map((r) => [r.ref, r.region.label, r.origin, r.spec, r.region.basis, r.mid, r.low, r.high, assessmentDate].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `jce-prices-${assessmentDate}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const tabs = [{ id: "all", label: "All regions" }, ...regions.map((r) => ({ id: r.id, label: r.label }))];

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Filter by region">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={region === t.id}
              onClick={() => setRegion(t.id)}
              className={cn("relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", region === t.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {region === t.id && <motion.span layoutId={`tab-${compact}`} className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
        {!compact && (
          <div className="relative min-w-48 flex-1 sm:max-w-64">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ref, origin, grade…" className="h-9 pl-8" aria-label="Search prices" />
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setSort((s) => (s === "board" ? "mid-desc" : s === "mid-desc" ? "mid-asc" : "board"))}>
            <ArrowDownUp /> {sort === "board" ? "Board order" : sort === "mid-desc" ? "Highest first" : "Lowest first"}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={exportCsv}>
            <Download /> CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="px-4 py-3 font-medium">Origin</th>
              <th className="px-4 py-3 text-right font-medium">Grade</th>
              <th className="px-4 py-3 text-right font-medium">Mid $/t</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Range (±4% scale)</th>
              <th className="px-4 py-3 text-right font-medium">Low – High</th>
              <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">IDR / t</th>
              <th className="px-4 py-3 font-medium">Check</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((r, i) => {
                const bad = r.low > r.high;
                return (
                  <motion.tr
                    key={r.ref + r.region.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.015, 0.2) }}
                    className="border-b last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">{r.ref}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.origin}</div>
                      <div className="text-xs text-muted-foreground">{r.region.label}</div>
                    </td>
                    <td className="tnum px-4 py-3 text-right whitespace-nowrap">
                      {num(r.spec)} <span className="text-xs text-muted-foreground">{r.region.basis}</span>
                    </td>
                    <td className="tnum px-4 py-3 text-right text-base font-bold">{usd(r.mid)}</td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <RangeBar mid={r.mid} low={r.low} high={r.high} />
                    </td>
                    <td className="tnum px-4 py-3 text-right whitespace-nowrap text-muted-foreground">
                      {usd(r.low)} – {usd(r.high)}
                    </td>
                    <td className="tnum hidden px-4 py-3 text-right text-muted-foreground lg:table-cell">{idrCompact(r.mid, fxRate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <StatusIcon level={bad ? "critical" : "pass"} />
                        {bad ? "Range inverted" : `±${halfWidthPct(r).toFixed(1)}%`}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">No assessments match “{q}”.</p>}
      </div>
    </div>
  );
}
