export type SourceState = "connected" | "live" | "licence";

export const SOURCES: { name: string; role: string; cadence: string; method: string; state: SourceState; url?: string }[] = [
  { name: "Sceats Coal Report · JCE", role: "Primary assessments", cadence: "Weekly", method: "Editor upload → AI reads the board → editor approves", state: "connected" },
  { name: "Kementerian ESDM (Indonesia)", role: "HBA official decree", cadence: "Twice monthly", method: "Daily AI web search → queued for editor approval", state: "connected", url: "https://www.esdm.go.id/" },
  { name: "DDTC · IMA-API · Kontan · detik · others", role: "Independent corroboration", cadence: "Per HBA release", method: "Two outlets must agree, or the Ministry release", state: "connected" },
  { name: "ECB reference rates (Frankfurter)", role: "USD/IDR conversion", cadence: "Daily", method: "Public API, refreshed hourly", state: "live", url: "https://frankfurter.dev/" },
  { name: "Argus/McCloskey’s · OPIS", role: "API2 · API4 · Newcastle", cadence: "Daily / weekly", method: "Licensed feed — redistribution terms required", state: "licence" },
];
