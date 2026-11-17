import { ExternalLink } from "lucide-react";
import { SOURCES } from "@/lib/sources";
import { cn } from "@/lib/utils";

const STATE = {
  connected: { label: "Connected", dot: "bg-good" },
  live: { label: "Live", dot: "bg-good animate-pulse" },
  licence: { label: "Licence needed", dot: "border border-muted-foreground bg-transparent" },
} as const;

export function SourcesTable() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Provides</th>
              <th className="px-5 py-3 font-medium">Cadence</th>
              <th className="px-5 py-3 font-medium">How it is used</th>
              <th className="px-5 py-3 font-medium">State</th>
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((s) => (
              <tr key={s.name} className="border-b align-top last:border-0">
                <td className="px-5 py-3.5 font-semibold">
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-primary">
                      {s.name} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    s.name
                  )}
                </td>
                <td className="px-5 py-3.5">{s.role}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{s.cadence}</td>
                <td className="px-5 py-3.5 text-muted-foreground">{s.method}</td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 text-xs font-medium">
                    <span className={cn("size-2 rounded-full", STATE[s.state].dot)} />
                    {STATE[s.state].label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
