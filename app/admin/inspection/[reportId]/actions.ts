"use server";

import { revalidatePath } from "next/cache";
import type { ComponentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import { getCurrentSessionUser } from "../../../../lib/session";
import { emptyInspectionState, inspectionSummary, type InspectionInstallation, type TechnicianInspectionState } from "../../../../lib/technician-inspection";

const COMPANY_ID = "org_rehn_vvs";
const FIELD_KEY = "technician_inspection";

export type InspectionActionResult =
  | { ok: true; message: string; state?: TechnicianInspectionState; reportStatus?: string }
  | { ok: false; message: string };

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return { value } as Prisma.InputJsonValue;
}

function storedAnswerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as { value?: unknown; values?: unknown };
  return record.value ?? record.values;
}

async function requireInternalUser() {
  const user = await getCurrentSessionUser();
  if (!user || user.companyId !== COMPANY_ID || user.role === "CUSTOMER") return null;
  return user;
}

async function getReport(reportId: string) {
  return prisma.houseReport.findFirst({
    where: { id: reportId, companyId: COMPANY_ID },
    include: {
      submission: { include: { answers: true } },
      property: true,
    },
  });
}

function statusFromInstallation(status: InspectionInstallation["status"]): ComponentStatus {
  if (status === "God") return "GREEN";
  if (status === "Bevaka") return "YELLOW";
  if (status === "Bör åtgärdas") return "ORANGE";
  if (status === "Akut") return "RED";
  return "GREY";
}

async function ensureComponentType(name: string, category: string) {
  return prisma.componentType.upsert({
    where: { companyId_name: { companyId: COMPANY_ID, name } },
    update: { category },
    create: { companyId: COMPANY_ID, name, category, normalLifeYears: 20 },
  });
}

async function ensureSystem(propertyId: string, name: string, category: string) {
  const existing = await prisma.technicalSystem.findFirst({ where: { companyId: COMPANY_ID, propertyId, name } });
  if (existing) return existing;
  return prisma.technicalSystem.create({ data: { companyId: COMPANY_ID, propertyId, name, category } });
}

async function syncInstallationToProperty(propertyId: string, inspectionId: string | null, installation: InspectionInstallation) {
  const category = /vatten|wc|brunn|blandare|fördelar|avstängning/i.test(installation.type) ? "Tappvatten" : "Värmesystem";
  const componentType = await ensureComponentType(installation.type || "Installation", category);
  const system = await ensureSystem(propertyId, category, category);
  const installedYear = Number(String(installation.installationYear).replace(/[^\d]/g, ""));
  const status = statusFromInstallation(installation.status);

  const component = await prisma.component.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      typeId: componentType.id,
      systemId: system.id,
      brand: installation.manufacturer || null,
      model: installation.model || null,
      serialNo: installation.serialNo || null,
      estimatedYear: Number.isFinite(installedYear) ? installedYear : null,
      estimateCertainty: "TECHNICIAN_VERIFIED",
      condition: installation.status,
      riskLevel: status === "RED" ? "HIGH" : status === "ORANGE" || status === "YELLOW" ? "MEDIUM" : "LOW",
      criticality: status === "RED" ? "HIGH" : "NORMAL",
      status,
      plannedReplacementYear: Number.isFinite(installedYear) ? installedYear + componentType.normalLifeYears : null,
      replacementCostCents: 0,
    },
  });

  await prisma.componentInspection.create({
    data: {
      companyId: COMPANY_ID,
      componentId: component.id,
      inspectionId,
      condition: installation.comment || installation.status,
      status,
      overrideReason: "Montörens platsbesiktning",
    },
  });

  await prisma.propertyComponent.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      customManufacturer: installation.manufacturer || null,
      customModelName: installation.model || null,
      serialNumber: installation.serialNo || null,
      installationYear: Number.isFinite(installedYear) ? installedYear : null,
      condition: installation.status,
      measuredValues: {
        rsk: installation.rsk,
        placement: installation.placement,
        power: installation.power,
        voltage: installation.voltage,
        volume: installation.volume,
        typePlate: installation.typePlate,
      },
      notes: installation.comment || null,
      photos: installation.photos.length ? installation.photos as Prisma.InputJsonValue : undefined,
      reviewStatus: installation.typePlate?.verified ? "TECHNICIAN_VERIFIED" : "NEEDS_REVIEW",
    },
  });
}

async function replaceInspectionAnswer(submissionId: string, state: TechnicianInspectionState) {
  await prisma.formAnswer.deleteMany({ where: { companyId: COMPANY_ID, submissionId, fieldKey: FIELD_KEY } });
  await prisma.formAnswer.create({
    data: {
      companyId: COMPANY_ID,
      submissionId,
      fieldKey: FIELD_KEY,
      value: jsonValue(state),
    },
  });
}

export async function startInspectionAction(reportId: string): Promise<InspectionActionResult> {
  const user = await requireInternalUser();
  if (!user) return { ok: false, message: "Du saknar behörighet att starta besiktning." };

  try {
    const report = await getReport(reportId);
    if (!report) return { ok: false, message: "Rapporten hittades inte." };

    const existing = report.submission.answers.find((answer) => answer.fieldKey === FIELD_KEY);
    const existingState = storedAnswerValue(existing?.value) as TechnicianInspectionState | undefined;
    const state = existingState ?? emptyInspectionState(report.id, report.propertyId, user.name);
    const startedState: TechnicianInspectionState = {
      ...state,
      status: "inspection_in_progress",
      inspectorName: state.inspectorName || user.name,
      startedAt: state.startedAt ?? new Date().toISOString(),
    };

    await replaceInspectionAnswer(report.submissionId, startedState);
    await prisma.houseReport.update({
      where: { id: report.id },
      data: {
        status: "inspection_in_progress",
        performedAt: report.performedAt ?? new Date(),
        performedBy: user.name,
      },
    });
    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: user.id,
        action: "START_TECHNICIAN_INSPECTION",
        entity: "HouseReport",
        entityId: report.id,
        after: { status: "inspection_in_progress", propertyId: report.propertyId },
      },
    });

    revalidatePath("/admin/reports");
    revalidatePath(`/admin/inspection/${report.id}`);
    revalidatePath("/husrapport");
    return { ok: true, message: "Besiktning startad.", state: startedState, reportStatus: "inspection_in_progress" };
  } catch {
    return { ok: false, message: "Besiktningen kunde inte startas." };
  }
}

export async function autosaveInspectionAction(reportId: string, state: TechnicianInspectionState): Promise<InspectionActionResult> {
  const user = await requireInternalUser();
  if (!user) return { ok: false, message: "Du saknar behörighet att spara besiktning." };

  try {
    const report = await getReport(reportId);
    if (!report) return { ok: false, message: "Rapporten hittades inte." };
    const nextState = {
      ...state,
      reportId: report.id,
      propertyId: report.propertyId,
      inspectorName: state.inspectorName || user.name,
    };
    await replaceInspectionAnswer(report.submissionId, nextState);
    return { ok: true, message: "Sparat.", state: nextState };
  } catch {
    return { ok: false, message: "Autosparning misslyckades. Ändringen ligger kvar lokalt tills du försöker igen." };
  }
}

export async function completeInspectionAction(reportId: string, state: TechnicianInspectionState, force = false): Promise<InspectionActionResult> {
  const user = await requireInternalUser();
  if (!user) return { ok: false, message: "Du saknar behörighet att avsluta besiktning." };

  try {
    const report = await getReport(reportId);
    if (!report) return { ok: false, message: "Rapporten hittades inte." };
    const summary = inspectionSummary(state);
    if (summary.missingAreas > 0 && !force) {
      return { ok: false, message: `${summary.missingAreas} områden är inte markerade som kontrollerade. Gå tillbaka eller bekräfta avslut igen.` };
    }

    const completedState: TechnicianInspectionState = {
      ...state,
      status: "review_required",
      completedAt: new Date().toISOString(),
      inspectorName: state.inspectorName || user.name,
    };

    await replaceInspectionAnswer(report.submissionId, completedState);
    for (const installation of completedState.installations.slice(0, 40)) {
      await syncInstallationToProperty(report.propertyId, report.submission.inspectionId, installation);
    }

    await prisma.houseReport.update({
      where: { id: report.id },
      data: {
        status: "review_required",
        performedAt: report.performedAt ?? new Date(),
        performedBy: user.name,
        summary: {
          ...(typeof report.summary === "object" && report.summary && !Array.isArray(report.summary) ? report.summary : {}),
          technicianInspection: {
            inspectionStartedAt: completedState.startedAt,
            inspectionCompletedAt: completedState.completedAt,
            inspectorUserId: user.id,
            inspectorName: user.name,
            summary,
            preliminaryRiskStatus: summary.urgentFindings ? "urgent" : summary.risks.action ? "action" : summary.risks.watch ? "watch" : "low",
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: user.id,
        action: "COMPLETE_TECHNICIAN_INSPECTION",
        entity: "HouseReport",
        entityId: report.id,
        after: { status: "review_required", summary },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/inspection/${report.id}`);
    revalidatePath("/husrapport");
    revalidatePath("/portal");
    return { ok: true, message: "Huskontrollen är avslutad och väntar på intern granskning.", state: completedState, reportStatus: "review_required" };
  } catch {
    return { ok: false, message: "Besiktningen kunde inte avslutas." };
  }
}
