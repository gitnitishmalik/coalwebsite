"use server";

import { redirect } from "next/navigation";
import { authReady, checkPassword, startSession } from "@/lib/auth";
import { audit } from "@/lib/store";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!authReady()) return { error: "Admin login is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET in the environment." };
  const name = String(form.get("name") ?? "").trim().slice(0, 40) || "Editor";
  const password = String(form.get("password") ?? "");
  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return { error: "Incorrect password." };
  }
  await startSession(name);
  try {
    await audit("Signed in", name);
  } catch {}
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/admin") ? next : "/admin");
}
