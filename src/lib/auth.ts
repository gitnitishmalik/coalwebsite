import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_HOURS, sessionConfigured, signSession, verifySession } from "./session";

/**
 * Admin sign-in with email + password.
 *   ADMIN_EMAIL    – the admin's email (several allowed, comma-separated)
 *   ADMIN_PASSWORD – set by the owner; there is no default
 */

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export function authReady() {
  return adminEmails().length > 0 && Boolean(process.env.ADMIN_PASSWORD) && sessionConfigured();
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function checkLogin(email: string, password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const okEmail = adminEmails().includes(email.trim().toLowerCase());
  const okPassword = timingSafeEqual(digest(password), digest(expected));
  return okEmail && okPassword;
}

/** "jakartacoal.admin@gmail.com" → "Jakartacoal Admin" */
export function displayName(email: string) {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export async function startSession(email: string) {
  const token = await signSession(email.trim().toLowerCase());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in admin, or null. Also rejects sessions whose email was removed from ADMIN_EMAIL. */
export async function currentAdmin() {
  const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!s || !adminEmails().includes(s.user)) return null;
  return { email: s.user, user: displayName(s.user) };
}

/** Call at the top of every admin server action / page. Proxy alone is not enough. */
export async function requireAdmin() {
  const s = await currentAdmin();
  if (!s) redirect("/admin/login");
  return s;
}
