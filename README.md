# Jakarta Coal Exchange — website + admin panel

Independent coal price discovery for Sceats Coal Report. Every number shows where it came from.

- **Public site** — overview, price board (search / sort / CSV), HBA benchmark with a sourced ledger, AI insights, methodology.
- **Admin panel** (`/admin`, email + password) — **Upload & AI**: drop a board image, Excel, PDF, CSV or pasted data; AI extracts the prices (images are read twice and compared), diffs them against the live board, runs the checks and writes an overview + summary in which every figure is traced back to the data. Apply to the draft, edit prices and the GAR ladder, approve HBA values, draft the market brief, publish.
- **Automation** — a daily job reads HBA news headlines, parses them with fixed rules (no AI), groups outlets that agree and queues them for approval. USD/IDR comes live from the ECB.
- **Checks** — rules flag inverted ranges, board/ladder mismatches, stale dates, single-source HBA values and outliers before anything is published.

Stack: Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui (Base UI) + Magic UI components, Motion, Recharts, NVIDIA AI (Nemotron), Upstash Redis, Vercel Blob, sharp, ExcelJS, unpdf.

## AI (NVIDIA)

| Job | Default model | Why |
|---|---|---|
| Analysis, summaries, market brief | `nvidia/nemotron-3-ultra-550b-a55b` | NVIDIA's strongest reasoning model, run with reasoning on |
| Reading images and documents | `nvidia/nemotron-3.5-super-vl-120b-a12b` | newest vision-language model, fast (12B active) |
| Quick tasks | `nvidia/nemotron-3.5-lightning-30b-a3b` | very fast |

Guards against hallucination: facts (diffs, checks, stats) are computed in code and the model only narrates them; low temperature; images are read twice in parallel and disagreements flagged; extracted numbers must appear in the source text; every number in AI-written text is traced back to the data and untraceable ones are shown to the editor. If a model is unavailable the next one is used. Test the connection in **Admin → Settings**.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The admin is at http://localhost:3000/admin — set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.local` first (there are no default credentials). Data is saved as JSON in `./.data` (git-ignored).

Copy `.env.example` to `.env.local` and fill it in.

## Deploy on Vercel

1. **Import** this GitHub repo in Vercel → *Add New → Project*. Framework: Next.js (auto). Deploy.
2. **Storage** → *Create Database* → **Upstash Redis** (free tier is fine) → connect to this project. This sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
3. **Storage** → *Create* → **Blob** → connect (optional, keeps uploaded board images). Sets `BLOB_READ_WRITE_TOKEN`.
4. **Settings → Environment Variables** — add:

   | Name | Value |
   |---|---|
   | `ADMIN_EMAIL` | the admin's Gmail (or any email; comma-separate several) |
   | `ADMIN_PASSWORD` | your password |
   | `ADMIN_SESSION_SECRET` | a long random string (`openssl rand -base64 32`) |
   | `NVIDIA_API_KEY` | from build.nvidia.com (starts with `nvapi-`) — enables upload analysis and the brief |
   | `CRON_SECRET` | any long random string — protects the daily HBA news monitor |
   | `NEXT_PUBLIC_SITE_URL` | e.g. `https://jakarta-coal.exchange` (optional) |

5. **Redeploy** (Deployments → ⋯ → Redeploy). Every push to `main` deploys automatically after that.

Without Redis the site still runs on the seed data and the admin panel shows a read-only notice.

## Moving to Hostinger later

The app needs Node.js (Hostinger *Node.js Web App* hosting or a VPS — not plain shared PHP hosting).

```bash
npm ci && npm run build
JCE_STORAGE=file ADMIN_EMAIL=… ADMIN_PASSWORD=… ADMIN_SESSION_SECRET=… NVIDIA_API_KEY=… npm start
```

With `JCE_STORAGE=file` everything is stored as JSON in `./.data` and images in `public/uploads`, so no database is required. Export a backup from **Admin → Settings → Download JSON** on Vercel and load it on the new host. Replace the Vercel cron with a server cron calling `GET /api/cron/hba` with header `Authorization: Bearer $CRON_SECRET`.

## Where things live

```
src/app/(site)/          public pages
src/app/admin/           login, panel pages, server actions
src/app/api/board        public JSON of the published board
src/app/api/cron/hba     daily HBA news monitor (queued for approval)
src/lib/store.ts         Redis / file / read-only storage
src/lib/nvidia.ts        NVIDIA API client (fallbacks, JSON parsing)
src/lib/ai.ts            AI jobs: read files, analyse uploads, draft brief
src/lib/grounding.ts     traces every AI-written number back to the data
src/lib/extract-file.ts  images (sliced), Excel, CSV, PDF → AI input
src/lib/hba-search.ts    daily HBA news monitor (rule-based, no AI)
src/lib/checks.ts        automated pre-publish checks
src/lib/seed.ts          starting data (real figures, with sources)
src/components/charts    Recharts charts
src/components/site      public UI
src/components/admin     admin UI
```

## Data notes

The seed board is transcribed from the price-board image published on the original site (assessment 01 Jun 2026). Five ladder values were hidden by a watermark and are marked *reconstructed*. HBA values for 2026 link to the reports they were read from; Feb-II and Aug-II are not yet verified. Methodology wording (“Top & Tailed Mid of Mids”) should be confirmed by Sceats Coal Report before launch.
