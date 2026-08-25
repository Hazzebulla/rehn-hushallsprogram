"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { clearSessionCookie, hashToken, isLocalDevSessionToken, SESSION_COOKIE } from "../../lib/session";

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token && !isLocalDevSessionToken(token)) {
    await prisma.authSession.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await clearSessionCookie();
  redirect("/login");
}
