"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export type InstallationPropertyOption = {
  id: string;
  label: string;
};

export type ComponentVm = {
  id: string;
  propertyName: string;
  systemName: string;
  typeName: string;
  category: string;
  brand: string;
  model: string;
  serialNo: string;
  installedYear: string;
  normalLifeYears: number;
  status: string;
  condition: string;
  riskLevel: string;
  criticality: string;
  plannedReplacementYear: number | null;
  replacementCostKr: number;
};

async function ensureComponentType(name: string, category: string, normalLifeYears: number) {
  return prisma.componentType.upsert({
    where: { companyId_name: { companyId: COMPANY_ID, name } },
    update: {
      category,
      normalLifeYears,
    },
    create: {
      companyId: COMPANY_ID,
      name,
      category,
      normalLifeYears,
      serviceIntervalMonths: category === "Värmesystem" ? 12 : null,
    },
  });
}

async function ensureSystem(propertyId: string, name: string, category: string) {
  const existing = await prisma.technicalSystem.findFirst({
    where: { companyId: COMPANY_ID, propertyId, name },
  });

  if (existing) return existing;

  return prisma.technicalSystem.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      name,
      category,
    },
  });
}

export async function createComponentAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const systemName = String(formData.get("systemName") ?? "").trim();
  const category = String(formData.get("category") ?? "Värmesystem").trim();
  const typeName = String(formData.get("typeName") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const serialNo = String(formData.get("serialNo") ?? "").trim();
  const installedYear = Number(formData.get("installedYear") ?? 0);
  const normalLifeYears = Number(formData.get("normalLifeYears") ?? 15);
  const condition = String(formData.get("condition") ?? "OK");
  const riskLevel = String(formData.get("riskLevel") ?? "LOW");
  const criticality = String(formData.get("criticality") ?? "NORMAL");
  const status = String(formData.get("status") ?? "GREEN");
  const replacementCostKr = Number(formData.get("replacementCostKr") ?? 0);

  if (!propertyId || !systemName || !typeName) {
    return { ok: false, message: "Välj fastighet och ange system samt komponenttyp." };
  }

  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId: COMPANY_ID },
    });

    if (!property) {
      return { ok: false, message: "Fastigheten finns inte i databasen." };
    }

    const componentType = await ensureComponentType(typeName, category, Number.isFinite(normalLifeYears) ? normalLifeYears : 15);
    const system = await ensureSystem(property.id, systemName, category);
    const plannedReplacementYear =
      Number.isFinite(installedYear) && installedYear > 1900
        ? installedYear + componentType.normalLifeYears
        : null;

    const component = await prisma.component.create({
      data: {
        companyId: COMPANY_ID,
        propertyId: property.id,
        typeId: componentType.id,
        systemId: system.id,
        brand: brand || null,
        model: model || null,
        serialNo: serialNo || null,
        estimatedYear: Number.isFinite(installedYear) && installedYear > 1900 ? installedYear : null,
        estimateCertainty: Number.isFinite(installedYear) && installedYear > 1900 ? "ADMIN_ENTERED" : null,
        condition,
        riskLevel,
        criticality,
        status: status as "GREEN" | "YELLOW" | "ORANGE" | "RED" | "GREY",
        replacementCostCents: Number.isFinite(replacementCostKr) ? Math.max(0, Math.round(replacementCostKr * 100)) : 0,
        plannedReplacementYear,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "CREATE_COMPONENT",
        entity: "Component",
        entityId: component.id,
        after: {
          propertyId: property.id,
          systemName,
          typeName,
          brand,
          model,
          status,
          riskLevel,
          plannedReplacementYear,
        },
      },
    });

    revalidatePath("/admin/installations");
    revalidatePath("/admin/properties");
    revalidatePath("/husrapport");
    revalidatePath("/portal");

    return { ok: true, message: "Komponenten sparades i installationsregistret." };
  } catch {
    return { ok: false, message: "Komponenten kunde inte sparas." };
  }
}
