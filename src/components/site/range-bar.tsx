"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Low–high band around the mid on a common ±scale%, so rows are comparable. */
export function RangeBar({ mid, low, high, scale = 4, className }: { mid: number; low: number; high: number; scale?: number; className?: string }) {
  const lo = Math.min(low, high), hi = Math.max(low, high);
  const bad = low > high;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - mid * (1 - scale / 100)) / (mid * (scale / 50))) * 100));
  return (
    <div className={cn("relative h-4 w-32", className)} aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded bg-border" />
      <motion.div
        className={cn("absolute top-1/2 h-2 -translate-y-1/2 rounded-full", bad ? "border-[1.5px] border-critical bg-critical/10" : "bg-jce")}
        style={{ left: `${pos(lo)}%` }}
        initial={{ width: 0 }}
        whileInView={{ width: `${pos(hi) - pos(lo)}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
      <div className="absolute top-0 h-4 w-0.5 rounded bg-foreground" style={{ left: `calc(${pos(mid)}% - 1px)` }} />
    </div>
  );
}
