import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";

export function SectionHeading({
  kicker,
  title,
  sub,
  action,
  className,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <BlurFade inView className={cn("mb-8 flex flex-wrap items-end justify-between gap-6", className)}>
      <div className="max-w-2xl">
        <p className="font-mono text-xs font-medium tracking-[0.16em] text-primary uppercase">{kicker}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance md:text-4xl">{title}</h2>
        {sub && <p className="mt-3 text-base text-pretty text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </BlurFade>
  );
}

export function PageHeader({ kicker, title, sub, children }: { kicker: string; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b bg-white">
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_100%_at_70%_0%,#000,transparent)] opacity-70" />
      <div className="container-x relative py-14 md:py-20">
        <BlurFade>
          <p className="font-mono text-xs font-medium tracking-[0.16em] text-primary uppercase">{kicker}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight text-balance md:text-5xl">{title}</h1>
          {sub && <p className="mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">{sub}</p>}
        </BlurFade>
        {children}
      </div>
    </section>
  );
}
