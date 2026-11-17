import "server-only";
import { getDraft, getPending, savePending } from "./store";
import type { HbaPoint, PendingHba, SourceLink } from "./types";

/**
 * Daily HBA finder — no AI, so nothing can be invented.
 * Reads news headlines (Google News RSS, Indonesian edition), parses the
 * period and US$ value with fixed rules, and groups agreeing outlets.
 * Results are queued for editor approval; nothing is published automatically.
 */

const MONTHS: Record<string, number> = {
  januari: 1, january: 1, jan: 1, februari: 2, february: 2, feb: 2, maret: 3, march: 3, mar: 3, april: 4, apr: 4,
  mei: 5, may: 5, juni: 6, june: 6, jun: 6, juli: 7, july: 7, jul: 7, agustus: 8, august: 8, agu: 8, aug: 8,
  september: 9, sept: 9, sep: 9, oktober: 10, october: 10, okt: 10, oct: 10, november: 11, nov: 11, desember: 12, december: 12, des: 12, dec: 12,
};
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const QUERIES = ['"harga batu bara acuan" periode', "HBA periode batubara US$"];

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

interface Headline {
  title: string;
  link: string;
  source: string;
  sourceUrl: string;
  pubDate: Date;
}

async function fetchHeadlines(): Promise<Headline[]> {
  const out = new Map<string, Headline>();
  for (const q of QUERIES) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; JCE-HBA-Monitor/1.0)" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!res.ok) continue;
    const xml = await res.text();
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = m[1];
      const get = (tag: string) => decode(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(item)?.[1] ?? "");
      const src = /<source url="([^"]*)">([\s\S]*?)<\/source>/.exec(item);
      const source = src ? decode(src[2]) : "";
      let title = get("title");
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      const link = get("link");
      if (!title || !link) continue;
      out.set(link, { title, link, source: source || new URL(link).hostname, sourceUrl: src?.[1] ?? "", pubDate: new Date(get("pubDate") || Date.now()) });
    }
  }
  return [...out.values()];
}

/** Parse "Harga Batu Bara Acuan Periode II Oktober 2026 Naik ke US$126,81/Ton" → Oct-II 2026 126.81 */
export function parseHeadline(h: Pick<Headline, "title" | "pubDate">): { period: string; date: string; value: number } | null {
  const t = h.title;
  if (!/(harga\s+batu\s?bara\s+acuan|\bHBA\b)/i.test(t)) return null;
  if (/kalori\s+rendah|\b(5[.,]300|4[.,]100|3[.,]400)\b/i.test(t)) return null; // other categories
  if (/\bHBA\s+(I{1,3}|[123])\b|kategori|batu\s?bara\s+(I{1,3})\b/i.test(t)) return null; // "HBA I/II/III" are other grades
  const half =
    /periode\s+(ii|kedua|2)\b/i.test(t) || /\bakhir\b/i.test(t) || /\b15\s*[-–]\s*(28|29|30|31)\b/.test(t)
      ? "II"
      : /periode\s+(i|pertama|1)\b/i.test(t) || /\bawal\b/i.test(t) || /\b0?1\s*[-–]\s*14\b/.test(t)
        ? "I"
        : null;
  if (!half) return null;
  const monthWord = Object.keys(MONTHS).sort((a, b) => b.length - a.length).find((m) => new RegExp(`\\b${m}\\b`, "i").test(t));
  if (!monthWord) return null;
  const month = MONTHS[monthWord];
  // Real HBA values always carry decimals; "tembus US$ 126" is a threshold, not a price.
  const v = /(?:US\$|USD|US\s\$)\s?(\d{2,3}[.,]\d{1,2})(?!\d)/i.exec(t);
  if (!v) return null;
  const value = Number(v[1].replace(",", "."));
  if (!(value >= 50 && value <= 300)) return null;
  let year = Number(/\b(20\d{2})\b/.exec(t)?.[1] ?? h.pubDate.getUTCFullYear());
  if (!/\b20\d{2}\b/.test(t) && month === 12 && h.pubDate.getUTCMonth() === 0) year -= 1;
  return { period: `${SHORT[month - 1]}-${half}`, date: `${year}-${String(month).padStart(2, "0")}-${half === "I" ? "01" : "15"}`, value };
}

/** Established outlets that count towards "corroborated". Others are kept as extra links only. */
const TRUSTED = /esdm|ddtc|kontan|detik|cnbc|bisnis|kumparan|tempo|antara|katadata|ima-api|infopublik|investor|validnews|liputan6|kompas|republika|petromindo|listrik ?indonesia|idx ?channel|okezone|cnn|tribun|merdeka|suara\.com|mining|emiten|akurat|rcti/i;
const isTrusted = (name: string, url: string) => TRUSTED.test(name) || TRUSTED.test(url);

export async function runHbaSearch(by: PendingHba["foundBy"]) {
  const [headlines, { board }, pending] = await Promise.all([fetchHeadlines(), getDraft(), getPending()]);
  const groups = new Map<string, { period: string; date: string; value: number; sources: SourceLink[]; trusted: number; official: boolean }>();
  // Only periods from the start of the ledger onwards (and never older than ~13 months).
  const ledgerStart = [...board.hba].map((p) => p.date).sort()[0] ?? "";
  const yearAgo = new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10);
  const cutoff = ledgerStart > yearAgo ? ledgerStart : yearAgo;
  for (const h of headlines) {
    const p = parseHeadline(h);
    if (!p || p.date < cutoff) continue;
    const key = `${p.date}|${p.value.toFixed(2)}`;
    const g = groups.get(key) ?? { ...p, sources: [], trusted: 0, official: false };
    if (!g.sources.some((s) => s.name === h.source)) {
      const trusted = isTrusted(h.source, h.sourceUrl);
      if (trusted) {
        g.sources.splice(g.trusted, 0, { name: h.source, url: h.link }); // trusted outlets first
        g.trusted++;
      } else g.sources.push({ name: h.source, url: h.link });
    }
    if (/esdm\.go\.id/i.test(h.sourceUrl)) g.official = true;
    groups.set(key, g);
  }

  let added = 0;
  for (const g of groups.values()) {
    const known = board.hba.find((p) => p.date === g.date);
    const sameValue = known?.value != null && Math.abs(known.value - g.value) < 0.005;
    if (!g.trusted) continue; // only republishers — not enough to queue
    const status: HbaPoint["status"] = g.official ? "official" : g.trusted >= 2 ? "corroborated" : "single";
    // Skip what we already hold at the same or better confidence.
    if (sameValue && known && (known.status === "official" || known.status === "corroborated" || (status === "single" && known.status === "single"))) continue;
    if (pending.some((p) => p.date === g.date && Math.abs((p.value ?? 0) - g.value) < 0.005)) continue;
    pending.unshift({
      id: crypto.randomUUID(),
      period: g.period,
      date: g.date,
      value: g.value,
      status,
      sources: g.sources.slice(0, 6),
      foundAt: new Date().toISOString(),
      foundBy: by,
      note: [known?.value != null && !sameValue ? `Differs from the recorded ${known.value}` : sameValue ? "Adds sources to an existing value" : null, `${g.trusted} established outlet${g.trusted === 1 ? "" : "s"}${g.sources.length > g.trusted ? ` + ${g.sources.length - g.trusted} other` : ""}`].filter(Boolean).join(" · "),
    });
    added++;
  }
  await savePending(pending.slice(0, 50));
  return { added, note: `${headlines.length} headlines read, ${groups.size} HBA values parsed.` };
}
