import { AdminTitle } from "@/components/admin/page-title";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { aiEnabled } from "@/lib/ai";
import { blobEnabled, getDraft, storeMode } from "@/lib/store";

export default async function AdminSettings() {
  const { board, isDraft } = await getDraft();
  const mode = storeMode();
  const status = [
    { label: "Database", env: "KV_REST_API_URL / KV_REST_API_TOKEN", ok: mode !== "readonly", detail: mode === "redis" ? "Upstash Redis connected" : mode === "file" ? "Local files (.data)" : "Not connected — add Upstash Redis" },
    { label: "Image storage", env: "BLOB_READ_WRITE_TOKEN", ok: blobEnabled() || mode === "file", detail: blobEnabled() ? "Vercel Blob connected" : mode === "file" ? "Saving to public/uploads" : "Optional — add Vercel Blob" },
    { label: "Claude AI", env: "ANTHROPIC_API_KEY", ok: aiEnabled(), detail: aiEnabled() ? "Enabled" : "Not set — AI features are off" },
    { label: "Admin password", env: "ADMIN_PASSWORD", ok: Boolean(process.env.ADMIN_PASSWORD), detail: process.env.ADMIN_PASSWORD ? "Set" : "Using the development default" },
    { label: "Session secret", env: "ADMIN_SESSION_SECRET", ok: Boolean(process.env.ADMIN_SESSION_SECRET), detail: process.env.ADMIN_SESSION_SECRET ? "Set" : "Using the development default" },
    { label: "Daily HBA search", env: "CRON_SECRET", ok: Boolean(process.env.CRON_SECRET), detail: process.env.CRON_SECRET ? "Runs daily at 02:00 UTC" : "Not set — the cron job will refuse to run" },
  ];
  return (
    <>
      <AdminTitle title="Settings" sub="Site text, backups and connections." />
      <SettingsEditor initial={board} isDraft={isDraft} status={status} />
    </>
  );
}
