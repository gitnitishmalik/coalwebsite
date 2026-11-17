"use client";

import { motion } from "motion/react";
import { usd } from "@/lib/format";

export function PossibilityBand({ now, low, high, spread }: { now: number; low: number; high: number; spread: number }) {
  const a = now - spread, b = now + spread;
  const P = (v: number) => ((v - a) / (b - a)) * 100;
  return (
    <div className="relative mt-6 h-14" aria-hidden>
      <span className="tnum absolute top-0 -translate-x-1/2 text-xs font-bold" style={{ left: `${P(now)}%` }}>
        now {usd(now)}
      </span>
      <div className="absolute inset-x-0 top-6 h-2 rounded-full bg-muted" />
      <motion.div
        className="absolute top-6 h-2 rounded-full bg-hba"
        initial={{ left: `${P(now)}%`, width: 0 }}
        whileInView={{ left: `${P(low)}%`, width: `${P(high) - P(low)}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      <div className="absolute top-4 h-6 w-0.5 rounded bg-foreground" style={{ left: `calc(${P(now)}% - 1px)` }} />
      <span className="tnum absolute top-10 -translate-x-1/2 text-[11px] text-muted-foreground" style={{ left: `${P(low)}%` }}>{usd(low)}</span>
      <span className="tnum absolute top-10 -translate-x-1/2 text-[11px] text-muted-foreground" style={{ left: `${P(high)}%` }}>{usd(high)}</span>
    </div>
  );
}
