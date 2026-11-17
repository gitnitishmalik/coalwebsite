"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Numeric input that lets people type freely and commits on blur/Enter. */
export function NumCell({
  value,
  onCommit,
  step = "0.01",
  className,
  nullable = false,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  step?: string;
  className?: string;
  nullable?: boolean;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(value == null ? "" : String(value));
  }
  const commit = () => {
    const t = text.trim();
    if (!t && nullable) return onCommit(null);
    const n = Number(t);
    if (Number.isFinite(n)) onCommit(n);
    else setText(value == null ? "" : String(value));
  };
  return (
    <input
      inputMode="decimal"
      value={text}
      aria-label={ariaLabel}
      data-step={step}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("tnum h-8 w-24 rounded-md border border-transparent bg-transparent px-2 text-right text-sm outline-none hover:border-border focus:border-ring focus:bg-white focus:ring-2 focus:ring-ring/20", className)}
    />
  );
}

export function TextCell({ value, onCommit, className, placeholder, "aria-label": ariaLabel }: { value: string; onCommit: (v: string) => void; className?: string; placeholder?: string; "aria-label"?: string }) {
  return (
    <input
      defaultValue={value}
      key={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onBlur={(e) => e.target.value !== value && onCommit(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-8 w-full min-w-24 rounded-md border border-transparent bg-transparent px-2 text-sm outline-none hover:border-border focus:border-ring focus:bg-white focus:ring-2 focus:ring-ring/20", className)}
    />
  );
}
