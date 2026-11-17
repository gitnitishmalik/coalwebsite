import type { Metadata } from "next";
import { DatabaseZap } from "lucide-react";
import { CommandCenter } from "@/components/admin/command-center";
import { AdminSidebar } from "@/components/admin/sidebar";
import { aiEnabled } from "@/lib/ai";
import { allRows } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth";
import { getDraft, getPending, storeMode } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const [pending, { board }] = await Promise.all([getPending(), getDraft()]);
  const mode = storeMode();
  const refs = allRows(board).map((r) => ({ ref: r.ref, label: `${r.region.label} · ${r.origin} ${r.spec} ${r.region.basis}` }));
  return (
    <div className="min-h-screen bg-background lg:flex">
      <AdminSidebar user={me.user} pendingHba={pending.length} />
      <div className="min-w-0 flex-1">
        {mode === "readonly" && (
          <div className="flex items-start gap-3 border-b border-warning/30 bg-amber-50 px-4 py-3 text-sm md:px-8">
            <DatabaseZap className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              <b>Read-only preview.</b> Storage isn’t connected, so changes can’t be saved. In Vercel open <b>Storage → Create → Upstash Redis</b>, connect it to this project, then redeploy.
              (Optional: add <b>Blob</b> storage for board images.)
            </p>
          </div>
        )}
        {children}
      </div>
      <CommandCenter refs={refs} aiOn={aiEnabled()} />
    </div>
  );
}
