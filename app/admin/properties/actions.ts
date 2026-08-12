"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export type PropertyVm = {
  id: string;
  customerName: string;
  customerId: string;
  propertyNo: string;
  type: string;
  address: string;
  buildYear: number | null;
  health: number;
  risk: number;
  nextAction: string;
  systems: number;
  documents: number;
  projects: number;
  createdAt: string;
};

export type PropertyCustomerOption = {
  id: string;
  name: string;
};

export async function createPropertyAction(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
  const propertyNo = String(formData.get("propertyNo") ?? "").trim();
  const type = String(formData.get("type") ?? "Villa").trim();
  const address = String(formData.get("address") ?? "").trim();
  const buildYearRaw = String(formData.get("buildYear") ?? "").trim();
  const heating = String(formData.get("heating") ?? "Ej angivet").trim();
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const risk = Number(formData.get("risk") ?? 28);
  const health = Number(formData.get("health") ?? 74);

  if (!customerId || !propertyNo || !address || !type) {
    return { ok: false, message: "Välj kund och fyll i fastighetsnamn, typ och adress." };
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: COMPANY_ID },
    });

    if (!customer) {
      return { ok: false, message: "Kunden finns inte i databasen." };
    }

    const property = await prisma.property.create({
      data: {
        companyId: COMPANY_ID,
        customerId: customer.id,
        propertyNo,
        type,
        address,
        buildYear: buildYearRaw ? Number(buildYearRaw) : null,
        healthScore: {
          create: {
            companyId: COMPANY_ID,
            score: Number.isFinite(health) ? Math.max(0, Math.min(100, Math.round(health))) : 74,
            explanation: {
              risk: Number.isFinite(risk) ? Math.max(0, Math.min(100, Math.round(risk))) : 28,
              heating,
              nextAction: nextAction || "Första genomgång saknas",
              source: "admin_property_form",
            },
          },
        },
      },
      include: { healthScore: true },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "CREATE_PROPERTY",
        entity: "Property",
        entityId: property.id,
        after: { customerId: customer.id, propertyNo, type, address, buildYear: property.buildYear },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/properties");
    revalidatePath("/admin/customers");
    revalidatePath("/portal");

    return { ok: true, message: "Fastigheten sparades i registret." };
  } catch {
    return { ok: false, message: "Fastigheten kunde inte sparas." };
  }
}
