import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter({ email }: { email: string }) {
  return (
    <footer className="mt-24 border-t bg-white">
      <div className="container-x grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Independent coal price discovery. No membership, no log-in, no subscription fee — and every number shows where it came from.
          </p>
          <a href={`mailto:${email}`} className="text-sm font-medium text-primary hover:underline">
            {email}
          </a>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Data</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/prices">Price board</Link></li>
            <li><Link className="hover:text-foreground" href="/benchmarks">HBA benchmark</Link></li>
            <li><Link className="hover:text-foreground" href="/insights">AI insights</Link></li>
            <li><a className="hover:text-foreground" href="/api/board">JSON API</a></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Company</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/methodology">Methodology</Link></li>
            <li><Link className="hover:text-foreground" href="/methodology#disclaimer">Disclaimer</Link></li>
            <li><Link className="hover:text-foreground" href="/admin">Editor login</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <div className="container-x flex flex-wrap justify-between gap-2 py-5 text-xs text-muted-foreground">
          <span>© {new Date().getUTCFullYear()} Sceats Coal Report. Jakarta Coal Exchange is not an exchange, broker or adviser.</span>
          <span>Information only — not investment advice.</span>
        </div>
      </div>
    </footer>
  );
}
