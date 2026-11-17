"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authReady, checkLogin, displayName, startSession } from "@/lib/auth";
import { audit, clearLoginFailures, loginFailures, recordLoginFailure } from "@/lib/store";

export type LoginState = { error?: string; email?: string } | undefined;

const MAX_ATTEMPTS = 5;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!authReady()) return { error: "Sign-in is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_SESSION_SECRET." };
  const email = String(form.get("email") ?? "").trim().slice(0, 120);
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  // Lock an address out for 15 minutes after 5 wrong attempts.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if ((await loginFailures(ip)) >= MAX_ATTEMPTS) return { error: "Too many attempts. Try again in 15 minutes.", email };

  if (!checkLogin(email, password)) {
    const n = await recordLoginFailure(ip);
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    const left = MAX_ATTEMPTS - n;
    return { error: left > 0 ? `Incorrect email or password. ${left} attempt${left === 1 ? "" : "s"} left.` : "Too many attempts. Try again in 15 minutes.", email };
  }
  await clearLoginFailures(ip);
  await startSession(email);
  try {
    await audit("Signed in", displayName(email));
  } catch {}
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}
