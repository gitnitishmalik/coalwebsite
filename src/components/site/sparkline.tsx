"use client";

import { motion } from "motion/react";

/** Tiny trend line; draws itself in when it enters the viewport. */
export function Sparkline({ values, color = "var(--hba)", className }: { values: number[]; color?: string; className?: string }) {
  if (values.length < 2) return null;
  const W = 200, H = 40, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const area = `${d}L${x(values.length - 1)} ${H}L${x(0)} ${H}Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} aria-hidden>
      <path d={area} fill={color} opacity={0.08} />
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
      />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill={color} />
    </svg>
  );
}
