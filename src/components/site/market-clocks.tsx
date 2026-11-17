"use client";

import { useEffect, useState } from "react";

const CITIES = [
  ["LON", "Europe/London"],
  ["JKT", "Asia/Jakarta"],
  ["SGP", "Asia/Singapore"],
] as const;

export function MarketClocks({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={className} aria-label="Market clocks">
      {CITIES.map(([label, tz]) => (
        <span key={label} className="flex items-baseline gap-1.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="tnum font-medium text-foreground">
            {now ? new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now) : "--:--"}
          </span>
        </span>
      ))}
    </div>
  );
}
