import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { FoundationRole } from "./foundation";

export const SESSION_COOKIE = "rehn_vvs_session";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export async function getCurrentSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const session = await prisma.authSession.findFirst({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session || !["ADMIN", "SUPERVISOR", "WORKER", "CUSTOMER"].includes(session.user.role)) {
    return null;
  }

  return {
    id: session.user.id,
    companyId: session.companyId,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as FoundationRole,
    expiresAt: session.expiresAt,
  };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
