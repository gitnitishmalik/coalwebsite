import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <defs>
        <linearGradient id="jce-ember" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f59e0b" />
          <stop offset=".55" stopColor="#ea580c" />
          <stop offset="1" stopColor="#9a3412" />
        </linearGradient>
      </defs>
      <path d="M16 2 28 9v14l-12 7L4 23V9z" fill="#fff7ed" stroke="url(#jce-ember)" strokeWidth="2" />
      <path d="M9.5 19.5l4-6 3 4 2.5-3.5 3.5 5.5" fill="none" stroke="url(#jce-ember)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className, sub = true }: { className?: string; sub?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-bold tracking-tight">Jakarta Coal Exchange</span>
        {sub && <span className="mt-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">by Sceats Coal Report</span>}
      </span>
    </span>
  );
}
