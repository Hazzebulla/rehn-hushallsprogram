"use server";

import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { verifyPassword } from "../../lib/password";
import { createSessionToken, hashToken, setSessionCookie } from "../../lib/session";

const COMPANY_ID = "org_rehn_vvs";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) redirect(loginErrorPath("missing", next));

  const account = await prisma.authAccount.findFirst({
    where: {
      companyId: COMPANY_ID,
      provider: "EMAIL",
      providerAccountId: email,
      user: { active: true },
    },
    include: { user: true },
  });

  if (!account || !verifyPassword(password, account.passwordHash)) redirect(loginErrorPath("invalid", next));

  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8);

  await prisma.$transaction([
    prisma.authSession.create({
      data: {
        companyId: account.companyId,
        userId: account.userId,
        tokenHash: hashToken(token),
        expiresAt,
      },
    }),
    prisma.user.update({
      where: { id: account.userId },
      data: { lastLoginAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        companyId: account.companyId,
        actorId: account.userId,
        action: "LOGIN",
        entity: "AuthSession",
        entityId: account.userId,
        after: { email, role: account.user.role, expiresAt: expiresAt.toISOString() },
      },
    }),
  ]);

  await setSessionCookie(token, expiresAt);
  redirect(next ?? (account.user.role === "CUSTOMER" ? "/portal" : "/admin"));
}

function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login")) return null;
  return value;
}

function loginErrorPath(error: "missing" | "invalid", next: string | null) {
  const params = new URLSearchParams({ error });
  if (next) params.set("next", next);
  return `/login?${params.toString()}`;
}
