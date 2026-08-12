"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export async function createGdprRequestAction(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
  const type = String(formData.get("type") ?? "EXPORT");
  const notes = String(formData.get("notes") ?? "");

  if (!["EXPORT", "DELETE", "RECTIFY"].includes(type)) {
    return { ok: false, message: "Ogiltig GDPR-typ." };
  }

  try {
    const request = await prisma.gdprRequest.create({
      data: {
        companyId: COMPANY_ID,
        customerId: customerId || null,
        type: type as "EXPORT" | "DELETE" | "RECTIFY",
        requestedBy: DEMO_ACTOR_ID,
        notes: notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "CREATE_GDPR_REQUEST",
        entity: "GdprRequest",
        entityId: request.id,
        after: { type, customerId: customerId || null, notes },
      },
    });

    revalidatePath("/admin/gdpr");
    return { ok: true, message: "GDPR-ärende skapades." };
  } catch {
    return { ok: false, message: "GDPR-ärendet kunde inte sparas." };
  }
}

export async function verifyGdprRequestAction(requestId: string) {
  try {
    await prisma.gdprRequest.update({
      where: { id: requestId },
      data: { status: "VERIFYING_IDENTITY", verifiedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "VERIFY_GDPR_IDENTITY",
        entity: "GdprRequest",
        entityId: requestId,
      },
    });
    revalidatePath("/admin/gdpr");
    return { ok: true, message: "Ärendet markerades för identitetskontroll." };
  } catch {
    return { ok: false, message: "GDPR-status kunde inte uppdateras." };
  }
}
