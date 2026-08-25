"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export type RequestVm = {
  id: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  customerName: string;
  propertyName: string;
  address: string;
  createdAt: string;
};

export async function createWorkOrderFromRequestAction(requestId: string) {
  try {
    const request = await prisma.customerRequest.findFirst({
      where: { id: requestId, companyId: COMPANY_ID },
    });

    if (!request) {
      return { ok: false, message: "Ärendet finns inte i databasen." };
    }

    const customer = await prisma.customer.findFirst({
      where: { id: request.customerId, companyId: COMPANY_ID },
    });

    if (!customer) {
      return { ok: false, message: "Kunden saknas." };
    }

    const property = request.propertyId
      ? await prisma.property.findFirst({
          where: { id: request.propertyId, companyId: COMPANY_ID },
        })
      : null;

    const projectNumber = `P-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;

    const project = await prisma.project.create({
      data: {
        companyId: COMPANY_ID,
        customerId: customer.id,
        propertyId: property?.id,
        number: projectNumber,
        name: `${request.category}: ${customer.name}`,
        status: "PLANNED",
        workOrders: {
          create: {
            companyId: COMPANY_ID,
            title: request.category,
            description: request.description,
            priority: request.priority === "HIGH" ? "HIGH" : "NORMAL",
            status: "ASSIGNED",
          },
        },
      },
      include: { workOrders: true },
    });

    await prisma.customerRequest.update({
      where: { id: request.id },
      data: { status: "CONVERTED_TO_WORK_ORDER" },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "CONVERT_REQUEST_TO_WORK_ORDER",
        entity: "CustomerRequest",
        entityId: request.id,
        after: {
          projectId: project.id,
          projectNumber: project.number,
          workOrderId: project.workOrders[0]?.id,
        },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/requests");

    return { ok: true, message: "Ärendet blev åtgärdsunderlag för Husrapport." };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Åtgärden kunde inte sparas." };
  }
}

export async function closeRequestAction(requestId: string) {
  try {
    await prisma.customerRequest.update({
      where: { id: requestId },
      data: { status: "CLOSED" },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "CLOSE_CUSTOMER_REQUEST",
        entity: "CustomerRequest",
        entityId: requestId,
      },
    });

    revalidatePath("/admin/requests");
    return { ok: true, message: "Ärendet stängdes." };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Ärendet kunde inte stängas." };
  }
}
