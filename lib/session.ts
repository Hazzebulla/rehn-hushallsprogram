import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { FoundationRole } from "./foundation";

export const SESSION_COOKIE = "rehn_vvs_session";
export const LOCAL_DEV_SESSION_TOKEN = "local-dev-rehn-vvs-session";

export function isLocalDevSessionToken(token: string | undefined) {
  return process.env.NODE_ENV === "development" && token === LOCAL_DEV_SESSION_TOKEN;
}

export function localDevSessionUser() {
  return {
    id: "local-dev-admin",
    companyId: "org_rehn_vvs",
    name: "Rehn VVS lokal admin",
    email: "info@rehnvvsmontage.se",
    role: "ADMIN" as FoundationRole,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 8),
  };
}

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
  if (isLocalDevSessionToken(token)) return localDevSessionUser();

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
