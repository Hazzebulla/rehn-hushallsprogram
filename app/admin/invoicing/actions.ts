"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";
const HOURLY_RATE_CENTS = 85_000;

export type InvoiceProjectVm = {
  id: string;
  number: string;
  name: string;
  customerName: string;
  propertyName: string;
  status: string;
  minutes: number;
  timeTotalKr: number;
  materialTotalKr: number;
  totalKr: number;
  invoiceStatus: string;
  invoiceId: string | null;
};

export async function createInvoiceBasisAction(projectId: string) {
  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, companyId: COMPANY_ID },
      include: {
        timeEntries: { where: { invoiceId: null } },
        materials: { where: { invoiceId: null } },
        invoices: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    if (!project) {
      return { ok: false, message: "Projektet finns inte i databasen." };
    }

    if (project.invoices[0]?.status === "DRAFT") {
      return { ok: false, message: "Det finns redan ett utkast för projektet." };
    }

    const timeCents = Math.round((project.timeEntries.reduce((total, entry) => total + entry.minutes, 0) / 60) * HOURLY_RATE_CENTS);
    const materialCents = project.materials.reduce((total, entry) => total + entry.salesCents, 0);
    const totalCents = timeCents + materialCents;

    if (totalCents <= 0) {
      return { ok: false, message: "Projektet saknar tid och material att fakturera." };
    }

    const invoice = await prisma.invoiceBasis.create({
      data: {
        companyId: COMPANY_ID,
        projectId: project.id,
        status: "DRAFT",
        totalCents,
      },
    });

    await prisma.$transaction([
      prisma.timeEntry.updateMany({
        where: { companyId: COMPANY_ID, projectId: project.id, invoiceId: null },
        data: { invoiceId: invoice.id, status: "APPROVED" },
      }),
      prisma.materialEntry.updateMany({
        where: { companyId: COMPANY_ID, projectId: project.id, invoiceId: null },
        data: { invoiceId: invoice.id, status: "APPROVED" },
      }),
      prisma.project.update({
        where: { id: project.id },
        data: { status: "READY_FOR_INVOICING" },
      }),
      prisma.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          actorId: DEMO_ACTOR_ID,
          action: "CREATE_INVOICE_BASIS",
          entity: "InvoiceBasis",
          entityId: invoice.id,
          after: {
            projectId: project.id,
            projectNumber: project.number,
            timeCents,
            materialCents,
            totalCents,
          },
        },
      }),
    ]);

    revalidatePath("/admin");
    revalidatePath("/admin/invoicing");
    revalidatePath("/admin/workorders");

    return { ok: true, message: "Fakturaunderlag skapades som utkast." };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Fakturaunderlag kunde inte skapas." };
  }
}
