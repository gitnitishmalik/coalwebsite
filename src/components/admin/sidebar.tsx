"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { ExternalLink, FileText, Gauge, Landmark, LogOut, Search, Settings, Sparkles, Table2 } from "lucide-react";
import { logoutAction } from "@/app/admin/actions";
import { Logo } from "@/components/site/logo";
import { PaletteButton } from "./command-center";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: Gauge },
  { href: "/admin/upload", label: "Upload & AI", icon: Sparkles },
  { href: "/admin/prices", label: "Prices", icon: Table2 },
  { href: "/admin/benchmarks", label: "HBA benchmark", icon: Landmark },
  { href: "/admin/insights", label: "AI brief", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ user, pendingHba }: { user: string; pendingHba: number }) {
  const path = usePathname();
  const items = NAV.map((n) => ({ ...n, active: n.href === "/admin" ? path === "/admin" : path.startsWith(n.href) }));
  return (
    <>
      {/* desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="border-b px-5 py-4">
          <Link href="/admin"><Logo sub={false} /></Link>
          <div className="mt-1 pl-[42px] font-mono text-[10px] tracking-widest text-muted-foreground uppercase">Admin panel</div>
          <PaletteButton className="mt-4" />
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Admin">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className={cn("relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", n.active ? "text-accent-foreground" : "text-ink-soft hover:bg-muted")}>
              {n.active && <motion.span layoutId="admin-nav" className="absolute inset-0 rounded-lg bg-accent" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <n.icon className="relative size-4" />
              <span className="relative">{n.label}</span>
              {n.href === "/admin/benchmarks" && pendingHba > 0 && (
                <span className="relative ml-auto rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{pendingHba}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <a href="/" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-muted">
            <ExternalLink className="size-4" /> View live site
          </a>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-muted">
              <LogOut className="size-4" /> Sign out <span className="ml-auto truncate text-xs text-muted-foreground">{user}</span>
            </button>
          </form>
        </div>
      </aside>

      {/* mobile */}
      <div className="sticky top-0 z-30 border-b bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo sub={false} />
          <button
            type="button"
            aria-label="Search or ask"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="ml-auto mr-3 grid size-9 place-items-center rounded-lg border text-muted-foreground"
          >
            <Search className="size-4" />
          </button>
          <form action={logoutAction}>
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium", n.active ? "bg-accent text-accent-foreground" : "text-ink-soft")}>
              <n.icon className="size-4" /> {n.label}
              {n.href === "/admin/benchmarks" && pendingHba > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{pendingHba}</span>}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
