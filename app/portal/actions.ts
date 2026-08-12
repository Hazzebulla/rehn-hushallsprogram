"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";

export async function createPortalRequestAction(input: {
  customerId: string;
  propertyId?: string;
  category: string;
  description: string;
}) {
  try {
    if (input.customerId.startsWith("LOCAL")) {
      return { ok: false, message: "Databasen är offline. Ärendet visas bara i demo." };
    }

    const request = await prisma.customerRequest.create({
      data: {
        companyId: COMPANY_ID,
        customerId: input.customerId,
        propertyId: input.propertyId,
        category: input.category,
        priority: input.category === "Akut läckage" ? "HIGH" : "NORMAL",
        description: input.description,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: input.customerId,
        action: "CREATE_CUSTOMER_REQUEST",
        entity: "CustomerRequest",
        entityId: request.id,
        after: {
          category: input.category,
          priority: request.priority,
          propertyId: input.propertyId,
        },
      },
    });

    revalidatePath("/portal");
    revalidatePath("/admin");

    return { ok: true, message: "Ärendet skapades och syns nu i SaaS-systemet." };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Ärendet visas bara i demo." };
  }
}
