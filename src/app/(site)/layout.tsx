import { Megaphone } from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getSiteData } from "@/lib/data";

export const revalidate = 300;

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const { board } = await getSiteData();
  return (
    <>
      {board.settings.announcement && (
        <div className="bg-foreground text-background">
          <div className="container-x flex items-center justify-center gap-2 py-2 text-center text-sm">
            <Megaphone className="size-4 shrink-0 text-amber-400" />
            {board.settings.announcement}
          </div>
        </div>
      )}
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter email={board.settings.contactEmail} />
    </>
  );
}
