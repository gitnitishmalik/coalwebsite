export function ChartTip({ title, rows, note }: { title: string; rows: { color?: string; value: string; label: string }[]; note?: string }) {
  return (
    <div className="min-w-44 rounded-xl border bg-white/95 px-3 py-2.5 text-xs shadow-[0_12px_32px_-12px_rgba(15,23,42,.25)] backdrop-blur">
      <div className="mb-1.5 text-muted-foreground">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="mt-1 flex items-center gap-2">
          {r.color ? <span className="h-0.5 w-3 shrink-0 rounded" style={{ background: r.color }} /> : <span className="w-3" />}
          <span className="tnum text-sm font-bold text-foreground">{r.value}</span>
          <span className="text-muted-foreground">{r.label}</span>
        </div>
      ))}
      {note && <div className="mt-1.5 text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}
