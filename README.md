# Jakarta Coal Exchange — website + admin panel

Independent coal price discovery for Sceats Coal Report. Every number shows where it came from.

- **Public site** — overview, price board (search / sort / CSV), HBA benchmark with a sourced ledger, AI insights, methodology.
- **Admin panel** (`/admin`) — upload the weekly board image and let Claude fill the tables, edit prices and the GAR ladder, approve HBA values Claude finds on the web, draft and approve the market brief, publish.
- **Automation** — a daily job searches for new HBA releases and queues them for approval. USD/IDR comes live from the ECB.
- **Checks** — rules flag inverted ranges, board/ladder mismatches, stale dates, single-source HBA values and outliers before anything is published.

Stack: Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui (Base UI) + Magic UI components, Motion, Recharts, Claude API, Upstash Redis, Vercel Blob.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The admin is at http://localhost:3000/admin — in development the password is `admin` until you set `ADMIN_PASSWORD`. Data is saved as JSON in `./.data` (git-ignored).

Copy `.env.example` to `.env.local` to set a password or enable Claude.

## Deploy on Vercel

1. **Import** this GitHub repo in Vercel → *Add New → Project*. Framework: Next.js (auto). Deploy.
2. **Storage** → *Create Database* → **Upstash Redis** (free tier is fine) → connect to this project. This sets `KV_REST_API_URL` / `KV_REST_API_TOKEN`.
3. **Storage** → *Create* → **Blob** → connect (optional, keeps uploaded board images). Sets `BLOB_READ_WRITE_TOKEN`.
4. **Settings → Environment Variables** — add:

   | Name | Value |
   |---|---|
   | `ADMIN_PASSWORD` | the editor password |
   | `ADMIN_SESSION_SECRET` | a long random string (`openssl rand -base64 32`) |
   | `ANTHROPIC_API_KEY` | from console.anthropic.com — enables image reading, the brief and HBA search |
   | `CRON_SECRET` | any long random string — protects the daily HBA job |
   | `NEXT_PUBLIC_SITE_URL` | e.g. `https://jakarta-coal.exchange` (optional) |

5. **Redeploy** (Deployments → ⋯ → Redeploy). Every push to `main` deploys automatically after that.

Without Redis the site still runs on the seed data and the admin panel shows a read-only notice.

## Moving to Hostinger later

The app needs Node.js (Hostinger *Node.js Web App* hosting or a VPS — not plain shared PHP hosting).

```bash
npm ci && npm run build
JCE_STORAGE=file ADMIN_PASSWORD=… ADMIN_SESSION_SECRET=… npm start
```

With `JCE_STORAGE=file` everything is stored as JSON in `./.data` and images in `public/uploads`, so no database is required. Export a backup from **Admin → Settings → Download JSON** on Vercel and load it on the new host. Replace the Vercel cron with a server cron calling `GET /api/cron/hba` with header `Authorization: Bearer $CRON_SECRET`.

## Where things live

```
src/app/(site)/          public pages
src/app/admin/           login, panel pages, server actions
src/app/api/board        public JSON of the published board
src/app/api/cron/hba     daily HBA search (queued for approval)
src/lib/store.ts         Redis / file / read-only storage
src/lib/ai.ts            Claude: read board image, draft brief, search HBA
src/lib/checks.ts        automated pre-publish checks
src/lib/seed.ts          starting data (real figures, with sources)
src/components/charts    Recharts charts
src/components/site      public UI
src/components/admin     admin UI
```

## Data notes

The seed board is transcribed from the price-board image published on the original site (assessment 01 Jun 2026). Five ladder values were hidden by a watermark and are marked *reconstructed*. HBA values for 2026 link to the reports they were read from; Feb-II and Aug-II are not yet verified. Methodology wording (“Top & Tailed Mid of Mids”) should be confirmed by Sceats Coal Report before launch.
