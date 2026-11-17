import { AdminTitle } from "@/components/admin/page-title";
import { HbaEditor } from "@/components/admin/hba-editor";
import { aiEnabled } from "@/lib/ai";
import { getDraft, getPending } from "@/lib/store";

export const maxDuration = 300;

export default async function AdminBenchmarks() {
  const [{ board, isDraft }, pending] = await Promise.all([getDraft(), getPending()]);
  return (
    <>
      <AdminTitle title="HBA benchmark" sub="Indonesia’s Government Reference Price. Approve what the daily news monitor finds, or edit the ledger and its sources directly." />
      <HbaEditor initial={board} isDraft={isDraft} pending={pending} aiOn={aiEnabled()} />
    </>
  );
}
