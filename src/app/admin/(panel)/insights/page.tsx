import { AdminTitle } from "@/components/admin/page-title";
import { BriefEditor } from "@/components/admin/brief-editor";
import { aiEnabled } from "@/lib/ai";
import { currentAdmin } from "@/lib/auth";
import { getDraft } from "@/lib/store";

export const maxDuration = 300;

export default async function AdminInsights() {
  const [{ board, isDraft }, me] = await Promise.all([getDraft(), currentAdmin()]);
  return (
    <>
      <AdminTitle title="AI market brief" sub="Generate a draft with AI, edit it, mark it reviewed, then publish." />
      <BriefEditor initial={board} isDraft={isDraft} aiOn={aiEnabled()} me={me?.user ?? "Editor"} />
    </>
  );
}
