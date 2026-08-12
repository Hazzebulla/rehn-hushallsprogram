"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export type WorkOrderVm = {
  id: string;
  projectId: string;
  projectNumber: string;
  title: string;
  customerName: string;
  propertyName: string;
  address: string;
  priority: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  minutes: number;
  materialTotalKr: number;
};

export type RegistrationResult =
  | { ok: true; message: string; workOrderId: string; minutes?: number; materialTotalKr?: number }
  | { ok: false; message: string };

export async function updateWorkOrderStatusAction(workOrderId: string, status: "ASSIGNED" | "IN_PROGRESS" | "DONE") {
  try {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: COMPANY_ID },
      include: { project: true },
    });

    if (!workOrder) {
      return { ok: false, message: "Arbetsordern finns inte i databasen." };
    }

    await prisma.$transaction([
      prisma.workOrder.update({
        where: { id: workOrder.id },
        data: { status },
      }),
      prisma.project.update({
        where: { id: workOrder.projectId },
        data: {
          status:
            status === "DONE"
              ? "READY_FOR_INVOICING"
              : status === "IN_PROGRESS"
                ? "ACTIVE"
                : workOrder.project.status,
        },
      }),
      prisma.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          actorId: DEMO_ACTOR_ID,
          action: "UPDATE_WORK_ORDER_STATUS",
          entity: "WorkOrder",
          entityId: workOrder.id,
          before: { status: workOrder.status },
          after: { status },
        },
      }),
    ]);

    revalidatePath("/admin");
    revalidatePath("/admin/workorders");

    return { ok: true, message: "Arbetsordern uppdaterades." };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Status kunde inte sparas." };
  }
}

export async function addTimeEntryAction(formData: FormData): Promise<RegistrationResult> {
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const minutes = Number(formData.get("minutes") ?? 0);
  const workType = String(formData.get("workType") ?? "Service");
  const description = String(formData.get("description") ?? "");

  if (!workOrderId || !Number.isFinite(minutes) || minutes <= 0) {
    return { ok: false, message: "Ange arbetsorder och tid." };
  }

  try {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: COMPANY_ID },
    });

    if (!workOrder) {
      return { ok: false, message: "Arbetsordern finns inte i databasen." };
    }

    await prisma.$transaction([
      prisma.timeEntry.create({
        data: {
          companyId: COMPANY_ID,
          projectId: workOrder.projectId,
          workOrderId: workOrder.id,
          userId: "usr_installer_rehn",
          minutes: Math.round(minutes),
          workType,
          description: description || null,
          status: "SUBMITTED",
        },
      }),
      prisma.workOrder.update({
        where: { id: workOrder.id },
        data: { status: workOrder.status === "ASSIGNED" ? "IN_PROGRESS" : workOrder.status },
      }),
      prisma.project.update({
        where: { id: workOrder.projectId },
        data: { status: "ACTIVE" },
      }),
      prisma.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          actorId: DEMO_ACTOR_ID,
          action: "ADD_TIME_ENTRY",
          entity: "WorkOrder",
          entityId: workOrder.id,
          after: { minutes: Math.round(minutes), workType, description },
        },
      }),
    ]);

    revalidatePath("/admin/workorders");
    return { ok: true, message: "Tid registrerades på arbetsordern.", workOrderId: workOrder.id, minutes };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Tid kunde inte sparas." };
  }
}

export async function addMaterialEntryAction(formData: FormData): Promise<RegistrationResult> {
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const name = String(formData.get("name") ?? "");
  const quantity = Number(formData.get("quantity") ?? 0);
  const unit = String(formData.get("unit") ?? "st");
  const salesKr = Number(formData.get("salesKr") ?? 0);

  if (!workOrderId || !name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(salesKr) || salesKr < 0) {
    return { ok: false, message: "Ange arbetsorder, material, antal och pris." };
  }

  try {
    const workOrder = await prisma.workOrder.findFirst({
      where: { id: workOrderId, companyId: COMPANY_ID },
    });

    if (!workOrder) {
      return { ok: false, message: "Arbetsordern finns inte i databasen." };
    }

    const salesCents = Math.round(salesKr * 100);

    await prisma.$transaction([
      prisma.materialEntry.create({
        data: {
          companyId: COMPANY_ID,
          projectId: workOrder.projectId,
          name,
          quantity,
          unit,
          costCents: Math.round(salesCents * 0.72),
          salesCents,
          status: "SUBMITTED",
        },
      }),
      prisma.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          actorId: DEMO_ACTOR_ID,
          action: "ADD_MATERIAL_ENTRY",
          entity: "Project",
          entityId: workOrder.projectId,
          after: { workOrderId: workOrder.id, name, quantity, unit, salesCents },
        },
      }),
    ]);

    revalidatePath("/admin/workorders");
    return {
      ok: true,
      message: "Material registrerades på projektet.",
      workOrderId: workOrder.id,
      materialTotalKr: salesKr,
    };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Material kunde inte sparas." };
  }
}
