"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { MarketClocks } from "./market-clocks";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/prices", label: "Prices" },
  { href: "/benchmarks", label: "HBA benchmark" },
  { href: "/insights", label: "AI insights" },
  { href: "/methodology", label: "Methodology" },
];

export function SiteHeader() {
  // When Vercel regenerates the cached home page (ISR), usePathname() reports "/index",
  // so the server HTML lost the active "Overview" pill and hydration failed (React #418).
  const raw = usePathname();
  const path = !raw || raw === "/index" ? "/" : raw;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  // Close the mobile menu after navigating (adjusting state during render, not in an effect).
  const [menuPath, setMenuPath] = useState(path);
  if (menuPath !== path) {
    setMenuPath(path);
    setOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled ? "border-border bg-white/85 shadow-[0_1px_12px_-6px_rgba(15,23,42,.12)] backdrop-blur-md" : "border-transparent bg-background/60 backdrop-blur",
      )}
    >
      <div className="container-x flex h-16 items-center gap-6">
        <Link href="/" aria-label="Jakarta Coal Exchange home" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
              >
                {active && (
                  <motion.span layoutId="nav-pill" className="absolute inset-0 -z-10 rounded-md bg-accent" transition={{ type: "spring", stiffness: 380, damping: 32 }} />
                )}
                {n.label}
              </Link>
            );
          })}
        </nav>
        <MarketClocks className="ml-auto hidden items-center gap-4 font-mono text-xs md:flex" />
        <button
          type="button"
          className="ml-auto grid size-10 place-items-center rounded-lg border bg-white lg:hidden md:ml-0"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t bg-white lg:hidden"
            aria-label="Mobile"
          >
            <div className="container-x flex flex-col py-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-md px-2 py-3 text-base font-medium hover:bg-accent">
                  {n.label}
                </Link>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
