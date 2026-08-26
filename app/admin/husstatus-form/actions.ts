"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { buildImageChecklist, summarizeImageChecklist, type ImageChecklistStatusMap, type SectionStatusMap } from "./image-checklist";
import { rvmFieldCount, rvmSections } from "./spec";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

type ComponentRegisterRow = {
  productModelId?: string;
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

type SignatureEntry = {
  id?: string;
  label?: string;
  signedBy?: string;
  role?: string;
  signedAt?: string;
  imageDataUrl?: string;
  signedHash?: string;
};

type SignatureMap = Record<string, SignatureEntry>;

type Answers = Record<string, string | string[] | ComponentRegisterRow[] | PhotoAttachment[] | ImageChecklistStatusMap | SectionStatusMap | SignatureMap>;

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
    if (value && typeof value === "object") {
      return Object.values(value).some((item) => String(item ?? "").trim().length > 0);
    }
    return String(value ?? "").trim().length > 0;
  });
}

const fieldSectionByKey = new Map(
  rvmSections.flatMap((section) => section.fields.map((field) => [field.key, section.id] as const)),
);

function sectionStatuses(answers: Answers): SectionStatusMap {
  const value = answers.section_statuses;
  return value && typeof value === "object" && !Array.isArray(value) ? value as SectionStatusMap : {};
}

function isSectionActive(answers: Answers, sectionId: number) {
  return sectionStatuses(answers)[String(sectionId)] !== "not_applicable";
}

function isFieldActive(answers: Answers, fieldKey: string) {
  const baseKey = fieldKey.replace(/__source$|__photos$/, "");
  const sectionId = fieldSectionByKey.get(baseKey);
  return sectionId ? isSectionActive(answers, sectionId) : true;
}

function activeAnswersForValidation(answers: Answers): Answers {
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) =>
      key !== "section_statuses"
      && key !== "image_checklist_statuses"
      && key !== "signatures"
      && isFieldActive(answers, key),
    ),
  ) as Answers;
}

function activeFieldCount(answers: Answers) {
  return rvmSections
    .filter((section) => isSectionActive(answers, section.id))
    .reduce((count, section) => count + section.fields.length, 0);
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

async function resolveSubmissionTarget(propertyId: string, reportId?: string) {
  if (!reportId) {
    const property = await prisma.property.findFirst({ where: { id: propertyId, companyId: COMPANY_ID }, include: { customer: true } });
    if (!property) return { ok: false as const, message: "Fastigheten finns inte i databasen." };
    const draft = await ensureDraftSubmission(property.id);
    return { ok: true as const, property, submission: draft, report: null };
  }

  const report = await prisma.houseReport.findFirst({
    where: { id: reportId, companyId: COMPANY_ID },
    include: {
      property: { include: { customer: true } },
      submission: { include: { inspection: true, version: true } },
    },
  });
  if (!report) return { ok: false as const, message: "Rapporten hittades inte. Ingen annan kunddata visas." };
  if (propertyId && propertyId !== report.propertyId) {
    return { ok: false as const, message: "Rapport och fastighet matchar inte. Sparning stoppad för att skydda kunddata." };
  }
  return { ok: true as const, property: report.property, submission: report.submission, report };
}

function enforceTargetIdentityAnswers(answers: Answers, target: {
  address: string;
  propertyNo: string | null;
  buildYear: number | null;
  customer: { name: string; phone: string | null; invoiceEmail: string | null };
}): Answers {
  return {
    ...answers,
    customer_name: target.customer.name,
    contact: [target.customer.phone, target.customer.invoiceEmail].filter(Boolean).join(" / "),
    property_address: [target.propertyNo, target.address].filter(Boolean).join(" / "),
    build_year: target.buildYear?.toString() ?? "",
  };
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
  if (value && typeof value === "object") return Object.values(value).map((item) => String(item));
  return [value];
}

function photoCountForAnswer(value: Answers[string] | undefined) {
  return Array.isArray(value) && value.every(isPhoto) ? value.length : 0;
}

function imageChecklistStatuses(value: Answers[string] | undefined): ImageChecklistStatusMap {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return value as ImageChecklistStatusMap;
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
  if (!row.typeName && !row.productModelId) return false;
  const product = row.productModelId
    ? await prisma.productModel.findFirst({
        where: { id: row.productModelId, active: true },
        include: { manufacturer: true },
      })
    : null;
  const typeName = row.typeName || product?.category || "Komponent";
  const category = row.category || product?.category || row.systemName || (/vatten|wc|brunn|disk/i.test(typeName) ? "Tappvatten" : "Värmesystem");
  const normalLifeYears = product?.expectedLifetimeMinYears ?? product?.expectedLifetimeMaxYears ?? 20;
  const componentType = await prisma.componentType.upsert({
    where: { companyId_name: { companyId: COMPANY_ID, name: typeName } },
    update: { category, normalLifeYears },
    create: { companyId: COMPANY_ID, name: typeName, category, normalLifeYears },
  });
  const system = await ensureSystem(propertyId, row.systemName || product?.systemType || category, category);
  const estimatedYear = Number(row.installedYear);
  const replacementYear = Number(row.replacementYear);
  const status = statusFromText(row.status || "");
  const costKr = Number(String(row.costKr ?? "").replace(/[^\d]/g, ""));
  const fallbackCostKr = product?.replacementPriceMinSek && product?.replacementPriceMaxSek
    ? Math.round((product.replacementPriceMinSek + product.replacementPriceMaxSek) / 2)
    : product?.replacementPriceMinSek ?? product?.replacementPriceMaxSek ?? 0;

  await prisma.component.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      typeId: componentType.id,
      systemId: system.id,
      productModelId: product?.id ?? null,
      brand: row.brand || product?.manufacturer.name || null,
      model: row.model || product?.modelName || null,
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
      replacementCostCents: Number.isFinite(costKr) && costKr > 0 ? costKr * 100 : fallbackCostKr * 100,
    },
  });

  await prisma.propertyComponent.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      productModelId: product?.id ?? null,
      customManufacturer: product ? null : row.brand || null,
      customModelName: product ? null : row.model || null,
      serialNumber: row.serialNo || null,
      installationYear: Number.isFinite(estimatedYear) ? estimatedYear : null,
      condition: row.status || null,
      notes: row.systemName || null,
      photos: row.photos?.length ? row.photos as Prisma.InputJsonValue : undefined,
      reviewStatus: product ? "LINKED_PRODUCT" : "NEEDS_REVIEW",
    },
  });

  if (product) {
    await prisma.productUsage.create({ data: { companyId: COMPANY_ID, productModelId: product.id } });
  }

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

  if (typeof register !== "string") return 0;

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
  const reportId = String(formData.get("reportId") ?? "");
  const payload = String(formData.get("answers") ?? "{}");

  if (!propertyId && !reportId) return { ok: false, message: "Välj fastighet." };

  try {
    const parsedAnswers = JSON.parse(payload) as Answers;
    const target = await resolveSubmissionTarget(propertyId, reportId || undefined);
    if (!target.ok) return { ok: false, message: target.message };
    const answers = reportId ? enforceTargetIdentityAnswers(parsedAnswers, target.property) : parsedAnswers;

    const entries = filledEntries(answers);
    await replaceSubmissionAnswers(target.submission.id, entries);

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "AUTOSAVE_RVM_HUSSTATUS_DRAFT",
        entity: "FormSubmission",
        entityId: target.submission.id,
        after: { propertyId: target.property.id, reportId: target.report?.id ?? null, fields: entries.length },
      },
    });

    revalidatePath("/husrapport");
    return { ok: true, submissionId: target.submission.id, message: `Utkast autosparat i databasen (${entries.length} fält).` };
  } catch {
    return { ok: false, message: "Utkastet kunde inte autosparas." };
  }
}

export async function completeHusstatusFormAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  const payload = String(formData.get("answers") ?? "{}");

  if (!propertyId && !reportId) return { ok: false, message: "Välj fastighet." };

  try {
    const parsedAnswers = JSON.parse(payload) as Answers;
    const target = await resolveSubmissionTarget(propertyId, reportId || undefined);
    if (!target.ok) return { ok: false, message: target.message };
    const { property } = target;
    const answers = reportId ? enforceTargetIdentityAnswers(parsedAnswers, property) : parsedAnswers;

    const entries = filledEntries(answers);
    const validationAnswers = activeAnswersForValidation(answers);
    const validationEntries = filledEntries(validationAnswers);
    const minimumRequired = ["customer_name", "property_address", "scope", "overall_status", "rvm_signer"];
    const missing = minimumRequired.filter((key) => isFieldActive(answers, key) && !validationEntries.some(([fieldKey]) => fieldKey === key));
    if (missing.length) {
      return { ok: false, message: `Komplettera obligatoriska fält innan rapport skapas: ${missing.join(", ")}.` };
    }

    const imageChecklist = buildImageChecklist(answers);
    const imageStatuses = imageChecklistStatuses(answers.image_checklist_statuses);
    const imageSummary = summarizeImageChecklist(
      imageChecklist,
      imageStatuses,
      (itemId) => photoCountForAnswer(answers[`${itemId}__photos`]),
    );
    if (imageSummary.missingRequired.length) {
      const missingImages = imageSummary.missingRequired.map((item) => item.title).slice(0, 6).join(", ");
      return {
        ok: false,
        message: `Genomgången kan inte slutföras. Obligatoriska bildpunkter saknas: ${missingImages}.`,
      };
    }

    await replaceSubmissionAnswers(target.submission.id, entries);

    if (target.submission.inspectionId) {
      await prisma.inspection.update({
        where: { id: target.submission.inspectionId },
        data: { status: "COMPLETED", performedAt: new Date() },
      });
    }

    const submission = await prisma.formSubmission.update({
      where: { id: target.submission.id },
      data: { status: "SUBMITTED", signedAt: new Date() },
      include: { version: true },
    });

    const overallStatus = typeof answers.overall_status === "string" ? answers.overall_status : undefined;
    const calculatedRisk = riskFromAnswers(validationAnswers, overallStatus);
    const calculatedScore = scoreFromRisk(calculatedRisk, overallStatus);
    const healthExplanation = {
      risk: calculatedRisk,
      heating: validationAnswers.heat_source_type ?? validationAnswers.hot_water_type ?? "Ej angivet",
      nextAction: answers.site_summary ?? answers.top_priority ?? "Rapporten behöver granskas",
      source: "rvm_husstatus_form",
      submissionId: submission.id,
      sufficientData: validationEntries.length >= Math.max(8, Math.round(activeFieldCount(answers) * 0.15)),
    };

    await prisma.propertyHealthScore.upsert({
      where: { propertyId: property.id },
      update: { score: calculatedScore, explanation: healthExplanation },
      create: { companyId: COMPANY_ID, propertyId: property.id, score: calculatedScore, explanation: healthExplanation },
    });

    const createdComponents = isSectionActive(answers, 19)
      ? await createComponentsFromRegister(property.id, answers.component_register_rows ?? answers.component_register)
      : 0;
    const report = target.report
      ? await prisma.houseReport.update({
          where: { id: target.report.id },
          data: {
            status: "READY_FOR_REVIEW",
            formVersion: submission.version.version,
            performedAt: new Date(),
            performedBy: typeof answers.rvm_signer === "string" ? answers.rvm_signer : null,
            reportOwner: typeof answers.report_owner_deadline === "string" ? answers.report_owner_deadline : null,
            nextControl: typeof answers.next_control === "string" ? answers.next_control : null,
            summary: {
              completedFields: entries.length,
              activeFields: activeFieldCount(answers),
              totalFields: rvmFieldCount,
              sectionStatuses: sectionStatuses(answers),
              source: "RVM Husstatus-formulär",
              updatedExistingReport: true,
            },
          },
        })
      : await prisma.houseReport.create({
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
              activeFields: activeFieldCount(answers),
              totalFields: rvmFieldCount,
              sectionStatuses: sectionStatuses(answers),
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
