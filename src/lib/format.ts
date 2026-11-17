export const usd = (v: number, d = 2) =>
  "$" + v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const num = (v: number, d = 0) =>
  v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const signed = (v: number, d = 2) =>
  (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(d);

export const signedUsd = (v: number, d = 2) =>
  (v > 0 ? "+" : v < 0 ? "−" : "±") + "$" + Math.abs(v).toFixed(d);

export const pct = (v: number, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%";

export const utc = (iso: string) => Date.parse(iso + "T00:00:00Z");

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) =>
  iso ? new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" }) : "—";

export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : "—";

export const idrCompact = (usdValue: number, rate: number) => "Rp " + ((usdValue * rate) / 1e6).toFixed(2) + "M";
