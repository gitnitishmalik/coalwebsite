import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdminTitle } from "@/components/admin/page-title";
import { PricesEditor } from "@/components/admin/prices-editor";
import { buttonVariants } from "@/components/ui/button";
import { aiEnabled } from "@/lib/ai";
import { getDraft } from "@/lib/store";

export const maxDuration = 300;

export default async function AdminPrices() {
  const { board, isDraft } = await getDraft();
  return (
    <>
      <AdminTitle title="Prices" sub="Upload the weekly board image or edit values directly. Changes stay in a draft until you publish.">
        <Link href="/prices" target="_blank" className={buttonVariants({ variant: "outline" })}>
          <ExternalLink /> Live board
        </Link>
      </AdminTitle>
      <PricesEditor initial={board} isDraft={isDraft} aiOn={aiEnabled()} />
    </>
  );
}
