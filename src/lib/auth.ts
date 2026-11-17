import "server-only";
import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_HOURS, sessionConfigured, signSession, verifySession } from "./session";

/** Password configured? In development a default is allowed so the panel works out of the box. */
export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV !== "production" ? "admin" : null;
}

export function authReady() {
  return adminPassword() !== null && sessionConfigured();
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function checkPassword(input: string): boolean {
  const expected = adminPassword();
  if (!expected) return false;
  return timingSafeEqual(digest(input), digest(expected));
}

export async function startSession(user: string) {
  const token = await signSession(user);
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

export async function currentAdmin() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

/** Call at the top of every admin server action / page. Proxy alone is not enough. */
export async function requireAdmin() {
  const s = await currentAdmin();
  if (!s) redirect("/admin/login");
  return s;
}
