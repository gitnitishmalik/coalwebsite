import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { Logo } from "@/components/site/logo";
import { authReady } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-12">
      <AnimatedGridPattern numSquares={30} maxOpacity={0.1} className="fill-primary/30 stroke-primary/10 [mask-image:radial-gradient(50%_50%_at_50%_50%,white,transparent)]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="rounded-2xl border bg-white p-7 shadow-[0_24px_60px_-30px_rgba(15,23,42,.3)]">
          <h1 className="text-xl font-bold">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Upload data, review AI summaries and publish prices.</p>
          {!authReady() ? (
            <div className="mt-6 space-y-2 rounded-lg border border-warning/40 bg-amber-50 p-3 text-sm">
              <p className="font-semibold">Sign-in isn’t set up yet.</p>
              <p>
                Add these in Vercel → Settings → Environment Variables (or <code className="font-mono">.env.local</code>), then redeploy:
              </p>
              <ul className="list-inside list-disc font-mono text-xs">
                <li>ADMIN_EMAIL</li>
                <li>ADMIN_PASSWORD</li>
                <li>ADMIN_SESSION_SECRET</li>
              </ul>
            </div>
          ) : (
            <LoginForm next={next} />
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground">← Back to the site</Link>
        </p>
      </div>
    </main>
  );
}
