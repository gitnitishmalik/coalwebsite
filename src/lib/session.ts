import { SignJWT, jwtVerify } from "jose";

/** Edge-safe session helpers (used by proxy.ts and server code). */

export const SESSION_COOKIE = "jce_admin";
export const SESSION_HOURS = 8;

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET || (process.env.NODE_ENV !== "production" ? "dev-only-secret-change-me-dev-only-secret" : "");
  return s ? new TextEncoder().encode(s) : null;
}

export function sessionConfigured() {
  return secret() !== null;
}

export async function signSession(user: string) {
  const key = secret();
  if (!key) throw new Error("ADMIN_SESSION_SECRET is not set");
  return new SignJWT({ sub: user, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key);
}

export async function verifySession(token: string | undefined | null): Promise<{ user: string } | null> {
  const key = secret();
  if (!token || !key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload.role === "admin" && typeof payload.sub === "string" ? { user: payload.sub } : null;
  } catch {
    return null;
  }
}
