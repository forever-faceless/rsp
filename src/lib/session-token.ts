import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "rsp_admin";
/** Thirty days, so the phone used for field surveys stays signed in between site visits. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type SessionPayload = { user: string };

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 16) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set to a long random string in production.");
  }
  return new TextEncoder().encode("dev-only-insecure-secret-change-me-please");
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.user === "string" && payload.user) return { user: payload.user };
    return null;
  } catch {
    return null;
  }
}
