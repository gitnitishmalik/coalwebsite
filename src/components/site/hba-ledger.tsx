import type { HbaPoint } from "@/lib/types";
import { isConfirmed, sortedHba } from "@/lib/analytics";
import { fmtDate, signed, usd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusIcon } from "./status-icon";

const LABEL: Record<HbaPoint["status"], string> = {
  official: "Official (Ministry)",
  corroborated: "Corroborated",
  single: "Single source",
  derived: "Derived",
  missing: "Not yet verified",
};

export function HbaLedger({ hba }: { hba: HbaPoint[] }) {
  const rows = sortedHba(hba).reverse();
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-5 py-3 font-medium">Period</th>
              <th className="px-5 py-3 font-medium">Applies from</th>
              <th className="px-5 py-3 text-right font-medium">HBA $/t</th>
              <th className="px-5 py-3 text-right font-medium">Change</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Sources (proof)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const prev = rows[i + 1];
              const d = p.value != null && prev?.value != null ? p.value - prev.value : null;
              return (
                <tr key={p.period + p.date} className="border-b align-top last:border-0 hover:bg-accent/30">
                  <td className="px-5 py-3 font-mono text-xs font-semibold">{p.period} {p.date.slice(0, 4)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{fmtDate(p.date)}</td>
                  <td className="tnum px-5 py-3 text-right font-bold">{p.value != null ? usd(p.value) : "—"}</td>
                  <td className={cn("tnum px-5 py-3 text-right font-medium", d == null ? "text-muted-foreground" : d < 0 ? "text-down" : "text-up")}>
                    {d == null ? "—" : signed(d)}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <StatusIcon level={p.value == null ? "warning" : isConfirmed(p) ? "pass" : "info"} />
                      {LABEL[p.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {p.sources.length ? (
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {p.sources.map((s) => (
                          <a key={s.url + s.name} href={s.url} target="_blank" rel="noopener nofollow" className="text-ink-soft underline decoration-border underline-offset-4 hover:text-primary hover:decoration-primary">
                            {s.name}
                          </a>
                        ))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
