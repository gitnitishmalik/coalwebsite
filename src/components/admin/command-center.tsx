"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bot, ExternalLink, FileText, Gauge, Landmark, LogOut, Newspaper, Search, Settings, Sparkles, Table2, Upload } from "lucide-react";
import { toast } from "sonner";
import { logoutAction, searchHbaAction } from "@/app/admin/actions";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AskAi } from "./ask-ai";

const ASK_EVENT = "jce:ask";
export const openAssistant = (q?: string) => window.dispatchEvent(new CustomEvent(ASK_EVENT, { detail: q ?? "" }));

/** ⌘K palette + floating AI assistant, mounted once in the admin layout. */
export function CommandCenter({ refs, aiOn }: { refs: { ref: string; label: string }[]; aiOn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [askOpen, setAskOpen] = useState(false);
  const [autoAsk, setAutoAsk] = useState<{ q: string; n: number } | null>(null);
  const [, start] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAskOpen((o) => !o);
      }
    };
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<string>).detail;
      setAskOpen(true);
      if (q) setAutoAsk({ q, n: Date.now() });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(ASK_EVENT, onAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(ASK_EVENT, onAsk);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      {/* trigger shown in the sidebar/topbar via openPalette() */}
      <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Jump anywhere or run an action">
        <Command>
          <CommandInput placeholder="Search pages, actions, references… or ask the AI" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button className="mx-auto flex items-center gap-2 text-sm text-primary" onClick={() => run(() => openAssistant(search))}>
                  <Sparkles className="size-4" /> Ask AI: “{search.trim()}”
                </button>
              ) : (
                "No results."
              )}
            </CommandEmpty>
            <CommandGroup heading="Go to">
              <CommandItem onSelect={() => go("/admin")}><Gauge /> Dashboard</CommandItem>
              <CommandItem onSelect={() => go("/admin/upload")}><Upload /> Upload & AI analysis</CommandItem>
              <CommandItem onSelect={() => go("/admin/prices")}><Table2 /> Prices editor</CommandItem>
              <CommandItem onSelect={() => go("/admin/benchmarks")}><Landmark /> HBA benchmark</CommandItem>
              <CommandItem onSelect={() => go("/admin/insights")}><FileText /> AI market brief</CommandItem>
              <CommandItem onSelect={() => go("/admin/settings")}><Settings /> Settings</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => run(() => setAskOpen(true))}>
                <Bot /> Open AI assistant <CommandShortcut>Ctrl J</CommandShortcut>
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() =>
                    start(async () => {
                      const id = toast.loading("Checking the news for HBA releases…");
                      const res = await searchHbaAction();
                      toast.dismiss(id);
                      if (res.ok) {
                        toast.success(res.message ?? "Done");
                        router.refresh();
                      } else toast.error(res.error);
                    }),
                  )
                }
              >
                <Newspaper /> Check the news for new HBA
              </CommandItem>
              <CommandItem onSelect={() => run(() => window.open("/", "_blank"))}><ExternalLink /> Open the live site</CommandItem>
              <CommandItem onSelect={() => run(() => start(() => logoutAction()))}><LogOut /> Sign out</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Price references">
              {refs.map((r) => (
                <CommandItem key={r.ref} value={`${r.ref} ${r.label}`} onSelect={() => go(`/admin/prices#${encodeURIComponent(r.ref)}`)}>
                  <span className="font-mono text-xs font-semibold text-primary">{r.ref}</span> <span className="truncate text-muted-foreground">{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {/* Always offered last, so typing a page name still selects the page first. */}
            {search.trim().length > 3 && aiOn && (
              <CommandGroup heading="AI" forceMount>
                <CommandItem value="__ask_ai__" forceMount onSelect={() => run(() => openAssistant(search))}>
                  <Sparkles /> Ask AI: “{search.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>

      {/* floating assistant button */}
      <AnimatePresence>
        {!askOpen && (
          <motion.button
            type="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ y: -2 }}
            onClick={() => setAskOpen(true)}
            className="fixed right-5 bottom-20 z-40 flex items-center gap-2 rounded-full bg-foreground py-2.5 pr-4 pl-3 text-sm font-semibold text-background shadow-[0_12px_32px_-10px_rgba(15,23,42,.55)] lg:bottom-6"
            aria-label="Open AI assistant"
          >
            <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600">
              <Sparkles className="size-4 text-white" />
            </span>
            Ask AI
            <Kbd className="hidden bg-white/15 text-background sm:inline-flex">Ctrl J</Kbd>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={askOpen} onOpenChange={setAskOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Ask the data</SheetTitle>
            <SheetDescription>Answers come only from your board, HBA ledger and uploads — every figure is checked.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 px-5 pb-5">
            <AskAi aiOn={aiOn} compact autoAsk={autoAsk} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function PaletteButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
      className={`flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-muted-foreground transition hover:border-primary/40 ${className}`}
    >
      <Search className="size-4" /> Search or ask…
      <Kbd className="ml-auto">Ctrl K</Kbd>
    </button>
  );
}
