"use server";

import { redirect } from "next/navigation";
import { authReady, checkLogin, displayName, startSession } from "@/lib/auth";
import { audit } from "@/lib/store";

export type LoginState = { error?: string; email?: string } | undefined;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!authReady()) return { error: "Sign-in is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_SESSION_SECRET." };
  const email = String(form.get("email") ?? "").trim().slice(0, 120);
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };
  if (!checkLogin(email, password)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return { error: "Incorrect email or password.", email };
  }
  await startSession(email);
  try {
    await audit("Signed in", displayName(email));
  } catch {}
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}
