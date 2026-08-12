"use server";

import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { PDFParse } from "pdf-parse";
import { prisma } from "../../../lib/prisma";
import { parseReportText } from "./parser";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "rapport.pdf";
}

async function ensureTemplateVersion() {
  const template = await prisma.formTemplate.upsert({
    where: { id: "tpl_husstatus_pdf_import" },
    update: { name: "Husstatus PDF-import", audience: "FIELD_TEAM" },
    create: {
      id: "tpl_husstatus_pdf_import",
      companyId: COMPANY_ID,
      name: "Husstatus PDF-import",
      audience: "FIELD_TEAM",
    },
  });

  return prisma.formVersion.upsert({
    where: { templateId_version: { templateId: template.id, version: 1 } },
    update: { publishedAt: new Date() },
    create: {
      companyId: COMPANY_ID,
      templateId: template.id,
      version: 1,
      publishedAt: new Date(),
      schema: {
        source: "pdf_import",
        fields: ["customerName", "propertyName", "address", "health", "risk", "nextAction", "components"],
      },
    },
  });
}

async function ensureComponentType(name: string, category: string, normalLifeYears: number) {
  return prisma.componentType.upsert({
    where: { companyId_name: { companyId: COMPANY_ID, name } },
    update: { category, normalLifeYears },
    create: { companyId: COMPANY_ID, name, category, normalLifeYears },
  });
}

async function ensureSystem(propertyId: string, name: string, category: string) {
  const existing = await prisma.technicalSystem.findFirst({
    where: { companyId: COMPANY_ID, propertyId, name },
  });
  if (existing) return existing;
  return prisma.technicalSystem.create({ data: { companyId: COMPANY_ID, propertyId, name, category } });
}

export async function importReportPdfAction(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const file = formData.get("file");

  if (!propertyId || !(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Välj fastighet och PDF-formulär." };
  }

  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, message: "Endast PDF stöds i denna import." };
  }

  try {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, companyId: COMPANY_ID },
      include: { customer: true },
    });
    if (!property) return { ok: false, message: "Fastigheten finns inte i databasen." };

    const bytes = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: bytes });
    const parsedPdf = await parser.getText();
    await parser.destroy();
    const parsed = parseReportText(parsedPdf.text);
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const cleanName = safeFileName(file.name);
    const storageKey = `${COMPANY_ID}/imports/${Date.now()}-${cleanName}`;
    const absolutePath = path.join(process.cwd(), "storage", "documents", storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);

    const templateVersion = await ensureTemplateVersion();
    const inspection = await prisma.inspection.create({
      data: {
        companyId: COMPANY_ID,
        propertyId: property.id,
        type: "HUSSTATUS_PDF_IMPORT",
        status: parsed.warnings.length ? "NEEDS_REVIEW" : "IMPORTED",
        performedAt: new Date(),
      },
    });

    const submission = await prisma.formSubmission.create({
      data: {
        companyId: COMPANY_ID,
        versionId: templateVersion.id,
        inspectionId: inspection.id,
        status: parsed.warnings.length ? "NEEDS_REVIEW" : "SUBMITTED",
        signedAt: new Date(),
        answers: {
          create: [
            { companyId: COMPANY_ID, fieldKey: "parsed_fields", value: parsed.fields },
            { companyId: COMPANY_ID, fieldKey: "parsed_components", value: parsed.components },
            { companyId: COMPANY_ID, fieldKey: "raw_text_excerpt", value: { text: parsed.rawText } },
            { companyId: COMPANY_ID, fieldKey: "warnings", value: { warnings: parsed.warnings, confidence: parsed.confidence } },
          ],
        },
      },
    });

    await prisma.documentAsset.create({
      data: {
        companyId: COMPANY_ID,
        customerId: property.customerId,
        propertyId: property.id,
        title: `Importerat husstatusformulär - ${property.propertyNo ?? property.address}`,
        fileName: cleanName,
        mimeType: "application/pdf",
        storageKey,
        checksumSha256,
        sizeBytes: file.size,
        visibility: "INTERNAL",
        uploadedById: DEMO_ACTOR_ID,
      },
    });

    if (parsed.fields.health || parsed.fields.risk || parsed.fields.nextAction || parsed.fields.heating) {
      await prisma.propertyHealthScore.upsert({
        where: { propertyId: property.id },
        update: {
          score: parsed.fields.health ?? 74,
          explanation: {
            risk: parsed.fields.risk ?? 28,
            heating: parsed.fields.heating ?? "Ej angivet",
            nextAction: parsed.fields.nextAction ?? "Importerad PDF behöver granskas",
            summary: parsed.fields.summary,
            source: "pdf_import",
            submissionId: submission.id,
            confidence: parsed.confidence,
          },
        },
        create: {
          companyId: COMPANY_ID,
          propertyId: property.id,
          score: parsed.fields.health ?? 74,
          explanation: {
            risk: parsed.fields.risk ?? 28,
            heating: parsed.fields.heating ?? "Ej angivet",
            nextAction: parsed.fields.nextAction ?? "Importerad PDF behöver granskas",
            summary: parsed.fields.summary,
            source: "pdf_import",
            submissionId: submission.id,
            confidence: parsed.confidence,
          },
        },
      });
    }

    let createdComponents = 0;
    for (const component of parsed.components) {
      const componentType = await ensureComponentType(component.typeName, component.category, component.normalLifeYears ?? 20);
      const system = await ensureSystem(property.id, component.systemName, component.category);
      const plannedReplacementYear =
        component.installedYear && componentType.normalLifeYears
          ? component.installedYear + componentType.normalLifeYears
          : null;

      await prisma.component.create({
        data: {
          companyId: COMPANY_ID,
          propertyId: property.id,
          typeId: componentType.id,
          systemId: system.id,
          brand: component.brand ?? null,
          model: component.model ?? null,
          serialNo: component.serialNo ?? null,
          estimatedYear: component.installedYear ?? null,
          estimateCertainty: component.installedYear ? "PDF_IMPORT" : null,
          condition: component.condition ?? "IMPORTED",
          riskLevel: component.riskLevel,
          criticality: component.riskLevel === "HIGH" ? "HIGH" : "NORMAL",
          status: component.status,
          replacementCostCents: Math.max(0, Math.round((component.replacementCostKr ?? 0) * 100)),
          plannedReplacementYear,
        },
      });
      createdComponents += 1;
    }

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "IMPORT_HUSSTATUS_PDF",
        entity: "Inspection",
        entityId: inspection.id,
        after: {
          propertyId: property.id,
          customerId: property.customerId,
          fileName: cleanName,
          checksumSha256,
          confidence: parsed.confidence,
          warnings: parsed.warnings,
          createdComponents,
        },
      },
    });

    revalidatePath("/admin/report-import");
    revalidatePath("/admin/installations");
    revalidatePath("/admin/properties");
    revalidatePath("/husrapport");
    revalidatePath("/portal");

    return {
      ok: true,
      message: `PDF importerad. ${createdComponents} komponenter skapades. Säkerhet: ${parsed.confidence}%.`,
      warnings: parsed.warnings,
    };
  } catch {
    return { ok: false, message: "PDF:en kunde inte läsas. Kontrollera att den inte är låst eller scannad utan text." };
  }
}
