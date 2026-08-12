"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { rvmFieldCount, rvmSections } from "./spec";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

type ComponentRegisterRow = {
  typeName?: string;
  systemName?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNo?: string;
  installedYear?: string;
  status?: string;
  replacementYear?: string;
  replacementPeriod?: string;
  costKr?: string;
  photos?: PhotoAttachment[];
};

type PhotoAttachment = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  createdAt?: string;
};

type Answers = Record<string, string | string[] | ComponentRegisterRow[] | PhotoAttachment[]>;

async function ensureTemplateVersion() {
  const template = await prisma.formTemplate.upsert({
    where: { id: "tpl_rvm_husstatus_24" },
    update: { name: "RVM Husstatus 25 avsnitt", audience: "FIELD_TEAM_AND_CUSTOMER" },
    create: {
      id: "tpl_rvm_husstatus_24",
      companyId: COMPANY_ID,
      name: "RVM Husstatus 25 avsnitt",
      audience: "FIELD_TEAM_AND_CUSTOMER",
    },
  });

  return prisma.formVersion.upsert({
    where: { templateId_version: { templateId: template.id, version: 1 } },
    update: { schema: { sections: rvmSections }, publishedAt: new Date() },
    create: {
      companyId: COMPANY_ID,
      templateId: template.id,
      version: 1,
      schema: { sections: rvmSections },
      publishedAt: new Date(),
    },
  });
}

function filledEntries(answers: Answers) {
  return Object.entries(answers).filter(([, value]) => {
    if (Array.isArray(value)) {
      if (!value.length) return false;
      if (typeof value[0] === "object") {
        return (value as ComponentRegisterRow[]).some((row) =>
          Object.values(row).some((cell) => String(cell ?? "").trim().length > 0),
        );
      }
      return value.length > 0;
    }
    return String(value ?? "").trim().length > 0;
  });
}

function storedAnswerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as { value?: unknown; values?: unknown };
  return record.value ?? record.values;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPhoto(value: unknown): value is PhotoAttachment {
  return isRecord(value) && typeof value.mimeType === "string" && "dataUrl" in value;
}

function restorePhotoData(incoming: PhotoAttachment, existingPhotos: PhotoAttachment[]) {
  if (incoming.dataUrl) return incoming;
  const existing = existingPhotos.find((photo) => photo.id && incoming.id && photo.id === incoming.id);
  return existing?.dataUrl ? { ...incoming, dataUrl: existing.dataUrl } : incoming;
}

function mergeStoredPhotoData(incoming: unknown, existing: unknown): unknown {
  if (Array.isArray(incoming)) {
    const existingArray = Array.isArray(existing) ? existing : [];

    if (incoming.every(isPhoto)) {
      return incoming.map((photo) => restorePhotoData(photo, existingArray.filter(isPhoto)));
    }

    return incoming.map((item, index) => {
      if (!isRecord(item)) return item;
      const existingItem = isRecord(existingArray[index]) ? existingArray[index] : {};
      const existingPhotos = Array.isArray(existingItem.photos) ? existingItem.photos.filter(isPhoto) : [];
      const photos = Array.isArray(item.photos)
        ? item.photos.filter(isPhoto).map((photo) => restorePhotoData(photo, existingPhotos))
        : item.photos;

      return { ...item, photos };
    });
  }

  return incoming;
}

async function replaceSubmissionAnswers(submissionId: string, entries: ReturnType<typeof filledEntries>) {
  const fieldKeys = entries.map(([fieldKey]) => fieldKey);
  const existingAnswers = fieldKeys.length
    ? await prisma.formAnswer.findMany({
        where: { companyId: COMPANY_ID, submissionId, fieldKey: { in: fieldKeys } },
      })
    : [];
  const existingByField = new Map(existingAnswers.map((answer) => [answer.fieldKey, storedAnswerValue(answer.value)]));
  const mergedEntries = entries.map(([fieldKey, value]) => [fieldKey, mergeStoredPhotoData(value, existingByField.get(fieldKey))] as const);

  await prisma.formAnswer.deleteMany({ where: { companyId: COMPANY_ID, submissionId } });
  if (!mergedEntries.length) return;

  await prisma.formAnswer.createMany({
    data: mergedEntries.map(([fieldKey, value]) => ({
      companyId: COMPANY_ID,
      submissionId,
      fieldKey,
      value: (Array.isArray(value) ? { values: value } : { value }) as Prisma.InputJsonValue,
    })),
  });
}

async function findLatestEditableSubmission(propertyId: string) {
  return prisma.formSubmission.findFirst({
    where: {
      companyId: COMPANY_ID,
      status: "DRAFT",
      inspection: { propertyId, companyId: COMPANY_ID, status: "DRAFT" },
    },
    include: { inspection: true },
    orderBy: { updatedAt: "desc" },
  });
}

async function ensureDraftSubmission(propertyId: string) {
  const existing = await findLatestEditableSubmission(propertyId);
  if (existing) return existing;

  const version = await ensureTemplateVersion();
  const inspection = await prisma.inspection.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      type: "RVM_HUSSTATUS_24",
      status: "DRAFT",
    },
  });

  return prisma.formSubmission.create({
    data: {
      companyId: COMPANY_ID,
      versionId: version.id,
      inspectionId: inspection.id,
      status: "DRAFT",
    },
    include: { inspection: true },
  });
}

async function nextReportNo() {
  const year = new Date().getFullYear();
  const count = await prisma.houseReport.count({
    where: { companyId: COMPANY_ID, reportNo: { startsWith: `RVM-HS-${year}-` } },
  });
  return `RVM-HS-${year}-${String(count + 1).padStart(4, "0")}`;
}

function scoreFromStatus(status?: string) {
  if (status === "God") return 86;
  if (status === "Normal") return 74;
  if (status === "Brister att planera") return 62;
  if (status === "Snar åtgärd") return 48;
  if (status === "Akut utredning") return 32;
  return 74;
}

function riskFromStatus(status?: string) {
  if (status === "God") return 14;
  if (status === "Normal") return 28;
  if (status === "Brister att planera") return 46;
  if (status === "Snar åtgärd") return 68;
  if (status === "Akut utredning") return 84;
  return 28;
}

function stringsFromAnswer(value: Answers[string]): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if ("dataUrl" in item) return [];
      return Object.entries(item)
        .filter(([key]) => key !== "photos")
        .map(([, cell]) => String(cell));
    });
  }
  return [value];
}

function riskFromAnswers(answers: Answers, status?: string) {
  let risk = riskFromStatus(status);

  for (const text of Object.values(answers).flatMap(stringsFromAnswer)) {
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/akut|hog|bor bytas|lackage|vattenskada|tryckfall/.test(normalized)) risk += 9;
    if (/avvikelse|saknas|rekommenderas|brist|fuktrisk|otat|underlagg saknas/.test(normalized)) risk += 6;
    if (/medel|planerad|periodvis|ej kontrollerat|okant/.test(normalized)) risk += 3;
    if (/god|bra|ok|finns|kontrollerat|nej/.test(normalized)) risk -= 2;
  }

  return Math.max(8, Math.min(92, Math.round(risk)));
}

function scoreFromRisk(risk: number, status?: string) {
  if (status) {
    return Math.max(18, Math.min(94, Math.round(scoreFromStatus(status) * 0.55 + (100 - risk) * 0.45)));
  }
  return Math.max(18, Math.min(94, 100 - risk));
}

function statusFromText(value: string): "GREEN" | "YELLOW" | "ORANGE" | "RED" | "GREY" {
  if (/röd|rod|hög|hog|akut|snar|bör bytas|bor bytas|ska bytas/i.test(value)) return "RED";
  if (/orange|plan/i.test(value)) return "ORANGE";
  if (/gul|medel|normal/i.test(value)) return "YELLOW";
  if (/grön|gron|god|ok|bra/i.test(value)) return "GREEN";
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

async function createComponentFromRow(propertyId: string, row: ComponentRegisterRow) {
  if (!row.typeName) return false;
  const category = row.category || row.systemName || (/vatten|wc|brunn|disk/i.test(row.typeName) ? "Tappvatten" : "Värmesystem");
  const componentType = await ensureComponentType(row.typeName, category);
  const system = await ensureSystem(propertyId, row.systemName || category, category);
  const estimatedYear = Number(row.installedYear);
  const replacementYear = Number(row.replacementYear);
  const status = statusFromText(row.status || "");
  const costKr = Number(String(row.costKr ?? "").replace(/[^\d]/g, ""));

  await prisma.component.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      typeId: componentType.id,
      systemId: system.id,
      brand: row.brand || null,
      model: row.model || null,
      serialNo: row.serialNo || null,
      estimatedYear: Number.isFinite(estimatedYear) ? estimatedYear : null,
      estimateCertainty: Number.isFinite(estimatedYear) ? "FORM_TABLE" : null,
      condition: row.status || "FORM_IMPORT",
      riskLevel: status === "RED" ? "HIGH" : status === "ORANGE" || status === "YELLOW" ? "MEDIUM" : "LOW",
      criticality: status === "RED" ? "HIGH" : "NORMAL",
      status,
      plannedReplacementYear: Number.isFinite(replacementYear) && replacementYear > 0
        ? replacementYear
        : Number.isFinite(estimatedYear) ? estimatedYear + componentType.normalLifeYears : null,
      replacementCostCents: Number.isFinite(costKr) ? costKr * 100 : 0,
    },
  });

  return true;
}

async function createComponentsFromRegister(propertyId: string, register?: Answers[string]) {
  if (!register) return 0;

  if (Array.isArray(register)) {
    if (!register.length || typeof register[0] !== "object") return 0;
    let created = 0;
    for (const row of (register as ComponentRegisterRow[]).slice(0, 20)) {
      if (await createComponentFromRow(propertyId, row)) created += 1;
    }
    return created;
  }

  const lines = register
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      const normalized = line.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return !normalized.includes("installationsregister") && !normalized.startsWith("komponent\t") && normalized !== "komponent";
    })
    .slice(0, 30);
  let created = 0;

  for (const line of lines) {
    const parts = line.includes(";")
      ? line.split(";").map((part) => part?.trim())
      : line.split(/\t+/).map((part) => part?.trim());
    const looksLikeReportRegister = parts.length >= 6 && /^\d{4}$/.test(parts[4] ?? "");
    const brandModelParts = (parts[1] ?? "").split(/\s+/).filter(Boolean);
    const [rawType, rawSystem, brand, model, year, rawStatus, replacementYearRaw, replacementPeriodRaw, cost] = looksLikeReportRegister
      ? [
          parts[0],
          parts[2] || "Värmesystem",
          brandModelParts[0] ?? "",
          brandModelParts.slice(1).join(" "),
          parts[4],
          parts[5],
          undefined,
          undefined,
          undefined,
        ]
      : parts;
    if (!rawType) continue;
    const category = rawSystem || (/vatten|wc|brunn|disk/i.test(rawType) ? "Tappvatten" : "Värmesystem");
    const componentType = await ensureComponentType(rawType, category);
    const system = await ensureSystem(propertyId, rawSystem || category, category);
    const estimatedYear = Number(year);
    const hasReplacementColumns = !looksLikeReportRegister && parts.length >= 9;
    const replacementYear = Number(hasReplacementColumns ? replacementYearRaw : undefined);
    const status = statusFromText(rawStatus || line);
    const costKr = Number(String(hasReplacementColumns ? cost : replacementYearRaw ?? cost ?? "").replace(/[^\d]/g, ""));

    await prisma.component.create({
      data: {
        companyId: COMPANY_ID,
        propertyId,
        typeId: componentType.id,
        systemId: system.id,
        brand: brand || null,
        model: model || null,
        estimatedYear: Number.isFinite(estimatedYear) ? estimatedYear : null,
        estimateCertainty: Number.isFinite(estimatedYear) ? "FORM_TEXT" : null,
        condition: rawStatus || "FORM_IMPORT",
        riskLevel: status === "RED" ? "HIGH" : status === "ORANGE" || status === "YELLOW" ? "MEDIUM" : "LOW",
        criticality: status === "RED" ? "HIGH" : "NORMAL",
        status,
        plannedReplacementYear: Number.isFinite(replacementYear) && replacementYear > 0
          ? replacementYear
          : Number.isFinite(estimatedYear) ? estimatedYear + componentType.normalLifeYears : null,
        replacementCostCents: Number.isFinite(costKr) ? costKr * 100 : 0,
      },
    });
    created += 1;
  }

  return created;
}

export async function autosaveHusstatusDraftAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const payload = String(formData.get("answers") ?? "{}");

  if (!propertyId) return { ok: false, message: "Välj fastighet." };

  try {
    const answers = JSON.parse(payload) as Answers;
    const property = await prisma.property.findFirst({ where: { id: propertyId, companyId: COMPANY_ID } });
    if (!property) return { ok: false, message: "Fastigheten finns inte i databasen." };

    const draft = await ensureDraftSubmission(property.id);
    const entries = filledEntries(answers);
    await replaceSubmissionAnswers(draft.id, entries);

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "AUTOSAVE_RVM_HUSSTATUS_DRAFT",
        entity: "FormSubmission",
        entityId: draft.id,
        after: { propertyId: property.id, fields: entries.length },
      },
    });

    revalidatePath("/husrapport");
    return { ok: true, submissionId: draft.id, message: `Utkast autosparat i databasen (${entries.length} fält).` };
  } catch {
    return { ok: false, message: "Utkastet kunde inte autosparas." };
  }
}

export async function completeHusstatusFormAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const payload = String(formData.get("answers") ?? "{}");

  if (!propertyId) return { ok: false, message: "Välj fastighet." };

  try {
    const answers = JSON.parse(payload) as Answers;
    const property = await prisma.property.findFirst({ where: { id: propertyId, companyId: COMPANY_ID } });
    if (!property) return { ok: false, message: "Fastigheten finns inte i databasen." };

    const entries = filledEntries(answers);
    const minimumRequired = ["customer_name", "property_address", "scope", "overall_status", "rvm_signer"];
    const missing = minimumRequired.filter((key) => !entries.some(([fieldKey]) => fieldKey === key));
    if (missing.length) {
      return { ok: false, message: `Komplettera obligatoriska fält innan rapport skapas: ${missing.join(", ")}.` };
    }

    const draft = await ensureDraftSubmission(property.id);
    await replaceSubmissionAnswers(draft.id, entries);

    if (draft.inspectionId) {
      await prisma.inspection.update({
        where: { id: draft.inspectionId },
        data: { status: "COMPLETED", performedAt: new Date() },
      });
    }

    const submission = await prisma.formSubmission.update({
      where: { id: draft.id },
      data: { status: "SUBMITTED", signedAt: new Date() },
      include: { version: true },
    });

    const overallStatus = typeof answers.overall_status === "string" ? answers.overall_status : undefined;
    const calculatedRisk = riskFromAnswers(answers, overallStatus);
    const calculatedScore = scoreFromRisk(calculatedRisk, overallStatus);
    const healthExplanation = {
      risk: calculatedRisk,
      heating: answers.heat_source_type ?? answers.hot_water_type ?? "Ej angivet",
      nextAction: answers.site_summary ?? answers.top_priority ?? "Rapporten behöver granskas",
      source: "rvm_husstatus_form",
      submissionId: submission.id,
      sufficientData: entries.length >= Math.max(12, Math.round(rvmFieldCount * 0.15)),
    };

    await prisma.propertyHealthScore.upsert({
      where: { propertyId: property.id },
      update: { score: calculatedScore, explanation: healthExplanation },
      create: { companyId: COMPANY_ID, propertyId: property.id, score: calculatedScore, explanation: healthExplanation },
    });

    const createdComponents = await createComponentsFromRegister(property.id, answers.component_register_rows ?? answers.component_register);
    const report = await prisma.houseReport.create({
      data: {
        companyId: COMPANY_ID,
        propertyId: property.id,
        submissionId: submission.id,
        reportNo: await nextReportNo(),
        status: "READY_FOR_REVIEW",
        formVersion: submission.version.version,
        reportVersion: 1,
        performedAt: new Date(),
        performedBy: typeof answers.rvm_signer === "string" ? answers.rvm_signer : null,
        reportOwner: typeof answers.report_owner_deadline === "string" ? answers.report_owner_deadline : null,
        nextControl: typeof answers.next_control === "string" ? answers.next_control : null,
        summary: {
          completedFields: entries.length,
          totalFields: rvmFieldCount,
          source: "RVM Husstatus-formulär",
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "COMPLETE_RVM_HUSSTATUS_FORM",
        entity: "FormSubmission",
        entityId: submission.id,
        after: { propertyId: property.id, fields: entries.length, createdComponents, reportId: report.id },
      },
    });

    revalidatePath("/admin/husstatus-form");
    revalidatePath("/admin/properties");
    revalidatePath("/admin/installations");
    revalidatePath("/husrapport");
    revalidatePath("/portal");

    return {
      ok: true,
      reportId: report.id,
      message: `Formuläret slutfördes. Rapport ${report.reportNo} skapades för granskning. ${entries.length} fält sparades och ${createdComponents} komponenter skapades.`,
    };
  } catch {
    return { ok: false, message: "Formuläret kunde inte sparas." };
  }
}
