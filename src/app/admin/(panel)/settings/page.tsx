import { AiTest } from "@/components/admin/ai-test";
import { AdminTitle, Panel } from "@/components/admin/page-title";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { aiEnabled, MODELS } from "@/lib/ai";
import { adminEmails } from "@/lib/auth";
import { blobEnabled, getDraft, storeMode } from "@/lib/store";

export const maxDuration = 120;

export default async function AdminSettings() {
  const { board, isDraft } = await getDraft();
  const mode = storeMode();
  const emails = adminEmails();
  const status = [
    { label: "Admin email", env: "ADMIN_EMAIL", ok: emails.length > 0, detail: emails.length ? `${emails.length} admin${emails.length > 1 ? "s" : ""}` : "Not set" },
    { label: "Admin password", env: "ADMIN_PASSWORD", ok: Boolean(process.env.ADMIN_PASSWORD), detail: process.env.ADMIN_PASSWORD ? "Set" : "Not set" },
    { label: "Session secret", env: "ADMIN_SESSION_SECRET", ok: Boolean(process.env.ADMIN_SESSION_SECRET), detail: process.env.ADMIN_SESSION_SECRET ? "Set" : "Using the development default" },
    { label: "NVIDIA AI", env: "NVIDIA_API_KEY", ok: aiEnabled(), detail: aiEnabled() ? "Set" : "Not set — AI features are off" },
    { label: "Database", env: "KV_REST_API_URL / KV_REST_API_TOKEN", ok: mode !== "readonly", detail: mode === "redis" ? "Upstash Redis connected" : mode === "file" ? "Local files (.data)" : "Not connected — add Upstash Redis" },
    { label: "File storage", env: "BLOB_READ_WRITE_TOKEN", ok: blobEnabled() || mode === "file", detail: blobEnabled() ? "Vercel Blob connected" : mode === "file" ? "Saving to public/uploads" : "Optional — add Vercel Blob" },
    { label: "Daily HBA monitor", env: "CRON_SECRET", ok: Boolean(process.env.CRON_SECRET), detail: process.env.CRON_SECRET ? "Runs daily at 02:00 UTC" : "Not set — the daily job will refuse to run" },
  ];
  return (
    <>
      <AdminTitle title="Settings" sub="Site text, backups, AI models and connections." />
      <div className="px-4 pt-6 md:px-8">
        <Panel title="AI models (NVIDIA)" sub="Change with NVIDIA_MODEL_REASONING, NVIDIA_MODEL_VISION and NVIDIA_MODEL_FAST. If a model is unavailable the next one is used automatically.">
          <AiTest models={MODELS} enabled={aiEnabled()} />
        </Panel>
      </div>
      <SettingsEditor initial={board} isDraft={isDraft} status={status} />
    </>
  );
}
