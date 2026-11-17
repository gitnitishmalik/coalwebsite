import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { Logo } from "@/components/site/logo";
import { authReady } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Editor sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  const devDefault = !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-12">
      <AnimatedGridPattern numSquares={30} maxOpacity={0.1} className="fill-primary/30 stroke-primary/10 [mask-image:radial-gradient(50%_50%_at_50%_50%,white,transparent)]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded-2xl border bg-white p-7 shadow-[0_24px_60px_-30px_rgba(15,23,42,.3)]">
          <h1 className="text-xl font-bold">Editor sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage prices, benchmarks and the AI brief.</p>
          {!authReady() ? (
            <p className="mt-6 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm">
              Login is not configured yet. Add <code className="font-mono">ADMIN_PASSWORD</code> and <code className="font-mono">ADMIN_SESSION_SECRET</code> in
              Vercel → Settings → Environment Variables, then redeploy.
            </p>
          ) : (
            <LoginForm next={next} />
          )}
          {devDefault && <p className="mt-4 text-xs text-muted-foreground">Local development: the password is <code className="font-mono">admin</code> until ADMIN_PASSWORD is set.</p>}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">← Back to the site</Link>
        </p>
      </div>
    </main>
  );
}
