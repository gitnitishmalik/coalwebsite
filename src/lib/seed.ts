import type { Board } from "./types";

/**
 * Seed board — used until a storage backend is connected, and as the
 * starting draft for a fresh store.
 *
 * Only real figures:
 *  - JCE assessment: transcribed from the price-board image published on
 *    the original site (Last Update 01/06/26).
 *  - HBA (Indonesian Government Reference Price, 6,322 GAR): 2026 periods,
 *    each with the public reports it was read from.
 * Ladder values hidden under a watermark in the source image are flagged
 * `reconstructed` (mid of the published ±1% range).
 */
export const SEED_BOARD: Board = {
  meta: {
    assessmentDate: "2026-06-01",
    nextUpdate: "2026-07-01",
    publishedAt: null,
    version: 1,
  },
  regions: [
    {
      id: "indonesia",
      label: "Indonesia",
      basis: "GAR",
      rows: [
        { ref: "SCR#1", origin: "Indonesia", spec: 6322, mid: 117.72, low: 116.54, high: 118.9 },
        { ref: "SCR#2", origin: "Indonesia", spec: 5800, mid: 93.67, low: 92.73, high: 94.61 },
        { ref: "SCR#3", origin: "Indonesia", spec: 5000, mid: 79.09, low: 78.3, high: 79.88 },
        { ref: "SCR#4", origin: "Indonesia", spec: 4200, mid: 62.53, low: 61.9, high: 63.16 },
        { ref: "SCR#5", origin: "Indonesia", spec: 3400, mid: 37.68, low: 37.3, high: 38.06 },
      ],
    },
    {
      id: "south-america",
      label: "South America",
      basis: "NAR",
      rows: [
        { ref: "SCR#6", origin: "Colombia", spec: 6000, mid: 101.64, low: 99.1, high: 104.18 },
        { ref: "SCR#7", origin: "Venezuela", spec: 6000, mid: 97.01, low: 94.58, high: 99.44 },
      ],
    },
    {
      id: "russia",
      label: "Russia",
      basis: "NAR",
      rows: [
        { ref: "SCR#8", origin: "Baltic", spec: 6000, mid: 86.47, low: 84.31, high: 88.64 },
        { ref: "SCR#9", origin: "Black Sea", spec: 6000, mid: 94.97, low: 92.6, high: 97.35 },
        { ref: "SCR#10", origin: "East", spec: 6000, mid: 117.25, low: 114.32, high: 120.19 },
        { ref: "SCR#11", origin: "East", spec: 5500, mid: 106.76, low: 104.09, high: 109.43 },
        { ref: "SCR#12", origin: "East", spec: 4700, mid: 79.42, low: 77.44, high: 81.41 },
      ],
    },
    {
      id: "usa",
      label: "USA",
      basis: "NAR",
      rows: [
        // Published with low/high swapped — kept as-is so the checks can flag it.
        { ref: "SCR#12a", origin: "East Coast ~3%S", spec: 6000, mid: 83.57, low: 86.07, high: 81.06 },
        { ref: "SCR#14", origin: "East Coast", spec: 6000, mid: 107.1, low: 104.43, high: 109.78 },
      ],
    },
  ],
  ladder: [
    { spec: 6322, mid: 118.76, low: 117.57, high: 119.95, ref: "SCR#1" },
    { spec: 6200, mid: 113.79, low: 112.65, high: 114.92 },
    { spec: 6100, mid: 108.94, low: 107.85, high: 110.03 },
    { spec: 6000, mid: 104.25, low: 103.21, high: 105.29 },
    { spec: 5900, mid: 99.8, low: 98.8, high: 100.8 },
    { spec: 5800, mid: 95.91, low: 94.95, high: 96.87, ref: "SCR#2" },
    { spec: 5700, mid: 93.49, low: 92.56, high: 94.43 },
    { spec: 5600, mid: 91.16, low: 90.25, high: 92.07 },
    { spec: 5500, mid: 88.92, low: 88.03, high: 89.81 },
    { spec: 5400, mid: 86.79, low: 85.93, high: 87.66 },
    { spec: 5300, mid: 84.8, low: 83.95, high: 85.64 },
    { spec: 5200, mid: 82.96, low: 82.13, high: 83.79 },
    { spec: 5100, mid: 81.35, low: 80.54, high: 82.16 },
    { spec: 5000, mid: 80.18, low: 79.38, high: 80.98, ref: "SCR#3", reconstructed: true },
    { spec: 4900, mid: 77.8, low: 77.02, high: 78.58, reconstructed: true },
    { spec: 4800, mid: 75.46, low: 74.71, high: 76.22, reconstructed: true },
    { spec: 4700, mid: 73.19, low: 72.46, high: 73.92 },
    { spec: 4600, mid: 70.98, low: 70.27, high: 71.69 },
    { spec: 4500, mid: 68.86, low: 68.17, high: 69.55 },
    { spec: 4400, mid: 66.84, low: 66.17, high: 67.51, reconstructed: true },
    { spec: 4300, mid: 64.97, low: 64.32, high: 65.62, reconstructed: true },
    { spec: 4200, mid: 63.44, low: 62.81, high: 64.07, ref: "SCR#4" },
    { spec: 4100, mid: 59.72, low: 59.12, high: 60.32 },
    { spec: 4000, mid: 56.1, low: 55.54, high: 56.66 },
    { spec: 3900, mid: 52.61, low: 52.08, high: 53.13 },
    { spec: 3800, mid: 49.25, low: 48.76, high: 49.74 },
    { spec: 3700, mid: 46.06, low: 45.59, high: 46.52 },
    { spec: 3600, mid: 43.07, low: 42.64, high: 43.5 },
    { spec: 3500, mid: 40.38, low: 39.98, high: 40.79 },
    { spec: 3400, mid: 38.31, low: 37.93, high: 38.69, ref: "SCR#5" },
  ],
  hba: [
    { period: "Jan-I", date: "2026-01-01", value: 103.3, status: "derived",
      sources: [{ name: "DDTC News (Jan-II report)", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1816640/naik-lagi-harga-batu-bara-acuan-periode-ii-januari-2026-us10403ton" }] },
    { period: "Jan-II", date: "2026-01-15", value: 104.03, status: "corroborated",
      sources: [
        { name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1816640/naik-lagi-harga-batu-bara-acuan-periode-ii-januari-2026-us10403ton" },
        { name: "Listrik Indonesia", url: "https://listrikindonesia.com/detail/19014/kepmen-esdm-terbit-hba-periode-kedua-januari-2026-alami-kenaikan" },
      ] },
    { period: "Feb-I", date: "2026-02-01", value: 106.11, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1817032/harga-batu-bara-acuan-periode-i-februari-2026-capai-us10611ton" }] },
    { period: "Feb-II", date: "2026-02-15", value: null, status: "missing", sources: [] },
    { period: "Mar-I", date: "2026-03-01", value: 102.37, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1817695/harga-batu-bara-acuan-periode-i-maret-2026-turun-ke-us10237ton" }] },
    { period: "Mar-II", date: "2026-03-15", value: 103.01, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1818029/harga-batu-bara-acuan-periode-ii-maret-2026-naik-jadi-us10301ton" }] },
    { period: "Apr-I", date: "2026-04-01", value: 99.87, status: "corroborated",
      sources: [
        { name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1818398/harga-batu-bara-acuan-periode-i-april-2026-merosot-jadi-us9987ton" },
        { name: "IMA-API", url: "https://ima-api.org/harga-batu-bara-acuan-hba-april-2026-kalori-tinggi-turun-ke-us9987-per-ton/" },
      ] },
    { period: "Apr-II", date: "2026-04-15", value: 103.43, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1818727/harga-batu-bara-acuan-periode-ii-april-2026-naik-jadi-us10343ton" }] },
    { period: "May-I", date: "2026-05-01", value: 106.57, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1819118/harga-batu-bara-acuan-periode-i-mei-2026-naik-jadi-us10657ton" }] },
    { period: "May-II", date: "2026-05-15", value: 116.32, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1819440/harga-batu-bara-acuan-periode-ii-mei-2026-naik-jadi-us11632ton" }] },
    { period: "Jun-I", date: "2026-06-01", value: 121.83, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1819821/harga-batu-bara-acuan-periode-i-juni-2026-naik-jadi-us12183ton" }] },
    { period: "Jun-II", date: "2026-06-15", value: 123.91, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1820121/harga-batu-bara-acuan-periode-ii-juni-2026-naik-jadi-us12391ton" }] },
    { period: "Jul-I", date: "2026-07-01", value: 126.58, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1820482/harga-batu-bara-acuan-periode-i-juli-2026-naik-lagi-ke-us12658ton" }] },
    { period: "Jul-II", date: "2026-07-15", value: 131.85, status: "corroborated",
      sources: [
        { name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1820860/harga-batu-bara-acuan-periode-ii-juli-2026-naik-lagi-ke-us13185ton" },
        { name: "RCTI+", url: "https://www.rctiplus.com/news/detail/ekonomi/5430582/4-harga-batu-bara-acuan-juli-2026--tertinggi-usd131-85-per-ton" },
      ] },
    { period: "Aug-I", date: "2026-08-01", value: 124.44, status: "official",
      sources: [
        { name: "ESDM (Ministry)", url: "https://www.esdm.go.id/en/media-center/news-archives/esdm-tetapkan-hba-periode-pertama-agustus-2026-usd-12444-per-ton-turun-562-persen" },
        { name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1821308/harga-batu-bara-acuan-periode-i-agustus-2026-turun-ke-us12444ton" },
        { name: "detik Finance", url: "https://finance.detik.com/energi/d-8601936/harga-acuan-batu-bara-ri-turun-jadi-us-124-44-per-ton" },
        { name: "Kontan", url: "https://industri.kontan.co.id/news/harga-batubara-acuan-kalori-tinggi-turun-ini-daftar-hba-terbaru-agustus-2026" },
      ] },
    { period: "Aug-II", date: "2026-08-15", value: null, status: "missing", sources: [] },
    { period: "Sep-I", date: "2026-09-01", value: 126.87, status: "single",
      sources: [{ name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1822088/harga-batu-bara-acuan-periode-i-september-2026-naik-ke-us12687ton" }] },
    { period: "Sep-II", date: "2026-09-15", value: 123.54, status: "derived",
      sources: [{ name: "DDTC News (Oct-I report)", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1823059/harga-batu-bara-acuan-periode-i-oktober-2026-turun-ke-us12252ton" }] },
    { period: "Oct-I", date: "2026-10-01", value: 122.52, status: "corroborated",
      sources: [
        { name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1823059/harga-batu-bara-acuan-periode-i-oktober-2026-turun-ke-us12252ton" },
        { name: "IMA-API", url: "https://ima-api.org/pengumuman-harga-batu-bara-ri-hba-awal-oktober-mayoritas-turun/" },
        { name: "Listrik Indonesia", url: "https://listrikindonesia.com/detail/21347/pemerintah-tetapkan-harga-batu-bara-oktober-mayoritas-turun" },
        { name: "Akurat", url: "https://www.akurat.co/riil/895790/harga-batu-bara-acuan-oktober-2026-turun-ini-rinciannya" },
      ] },
    { period: "Oct-II", date: "2026-10-15", value: 126.81, status: "corroborated",
      sources: [
        { name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1823399/harga-batu-bara-acuan-periode-ii-oktober-2026-naik-ke-us12681ton" },
        { name: "IMA-API", url: "https://ima-api.org/hba-periode-ii-oktober-2026-kompak-naik-kalori-tinggi-jadi-us12681/" },
      ] },
    { period: "Nov-I", date: "2026-11-01", value: 125.6, status: "corroborated",
      sources: [
        { name: "DDTC News", url: "https://news.ddtc.co.id/data-alat/pungutan-komoditas/1823764/harga-batu-bara-acuan-periode-i-november-2026-turun-jadi-us12560ton" },
        { name: "IMA-API", url: "https://ima-api.org/harga-acuan-batu-bara-hba-awal-november-2026-kalori-tinggi-turun-jadi-us1256/" },
      ] },
  ],
  brief: {
    paragraphs: [
      "JCE’s flagship Indonesian 6,322 GAR assessment (SCR#1) stands at $117.72/t, range $116.54–$118.90. That is $4.11/t (3.4%) below the government HBA for the same period (Jun-I, $121.83).",
      "Across the Indonesian GAR ladder, each 100 kcal step is worth about $2.75/t on average, from $118.76 at 6,322 GAR down to $38.31 at 3,400 GAR.",
      "On the NAR board, Russia East 6,000 is the highest-priced grade at $117.25/t — $30.78 above Baltic 6,000 ($86.47). Colombia 6,000 sits at $101.64.",
      "The HBA peaked at $131.85 in Jul-II and has eased to $125.60 (Nov-I), falling in 4 of the 5 consecutive revisions since. It is still $3.77 above Jun-I, so a fresh JCE assessment is due.",
    ],
    generatedAt: "2026-11-17T00:00:00.000Z",
    model: "Claude",
    reviewedBy: null,
    reviewedAt: null,
  },
  settings: {
    announcement: null,
    contactEmail: "info@jakarta-coal.exchange",
    boardImageUrl: null,
  },
};
