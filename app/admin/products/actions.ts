"use server";

import { revalidatePath } from "next/cache";
import type { ProductDataQuality } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { importJsEducationIndex } from "../../../lib/jseducation";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function cleanNumber(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function cleanInt(value: FormDataEntryValue | null) {
  const number = cleanNumber(value);
  return number === null ? null : Math.round(number);
}

function dataQuality(value: string): ProductDataQuality {
  if (value === "verified_manual") return "verified_manual";
  if (value === "manufacturer_source") return "manufacturer_source";
  if (value === "supplier_source") return "supplier_source";
  if (value === "estimated") return "estimated";
  return "unverified";
}

export async function upsertProductModelAction(formData: FormData) {
  const id = cleanText(formData.get("id"));
  const manufacturerName = cleanText(formData.get("manufacturer"));
  const category = cleanText(formData.get("category"));
  const modelName = cleanText(formData.get("modelName"));

  if (!manufacturerName || !category || !modelName) {
    return { ok: false, message: "Ange tillverkare, komponenttyp och modell." };
  }

  try {
    const manufacturer = await prisma.manufacturer.upsert({
      where: { name: manufacturerName },
      update: { website: cleanText(formData.get("website")) || null },
      create: { name: manufacturerName, website: cleanText(formData.get("website")) || null },
    });

    const payload = {
      manufacturerId: manufacturer.id,
      category,
      modelName,
      systemType: cleanText(formData.get("systemType")) || null,
      productionStartYear: cleanInt(formData.get("productionStartYear")),
      productionEndYear: cleanInt(formData.get("productionEndYear")),
      outputMinKw: cleanNumber(formData.get("outputMinKw")),
      outputMaxKw: cleanNumber(formData.get("outputMaxKw")),
      tankVolumeLitres: cleanInt(formData.get("tankVolumeLitres")),
      connectionSize: cleanText(formData.get("connectionSize")) || null,
      dimensions: cleanText(formData.get("dimensions")) || null,
      controlSystem: cleanText(formData.get("controlSystem")) || null,
      expectedLifetimeMinYears: cleanInt(formData.get("expectedLifetimeMinYears")),
      expectedLifetimeMaxYears: cleanInt(formData.get("expectedLifetimeMaxYears")),
      replacementPriceMinSek: cleanInt(formData.get("replacementPriceMinSek")),
      replacementPriceMaxSek: cleanInt(formData.get("replacementPriceMaxSek")),
      sourceUrl: cleanText(formData.get("sourceUrl")) || null,
      manualUrl: cleanText(formData.get("manualUrl")) || null,
      wiringDiagramUrl: cleanText(formData.get("wiringDiagramUrl")) || null,
      dataQuality: dataQuality(cleanText(formData.get("dataQuality"))),
      lastVerifiedAt: new Date(),
      active: cleanText(formData.get("active")) !== "false",
    };

    const product = id
      ? await prisma.productModel.update({ where: { id }, data: payload })
      : await prisma.productModel.upsert({
          where: {
            manufacturerId_category_modelName: {
              manufacturerId: manufacturer.id,
              category,
              modelName,
            },
          },
          update: payload,
          create: payload,
        });

    await prisma.productChangeLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        productModelId: product.id,
        action: id ? "UPDATE_PRODUCT_MODEL" : "UPSERT_PRODUCT_MODEL",
        after: payload,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/husstatus-form");
    return { ok: true, message: "Produkten sparades i registret." };
  } catch {
    return { ok: false, message: "Produkten kunde inte sparas." };
  }
}

export async function importProductCsvAction(formData: FormData) {
  const csv = cleanText(formData.get("csv"));
  if (!csv) return { ok: false, message: "Klistra in CSV-data först." };

  const log = await prisma.productImportLog.create({
    data: { source: "CSV", status: "RUNNING" },
  });

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const errors: string[] = [];

  try {
    const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const header = lines.shift()?.split(/[;,]/).map((cell) => cell.trim().toLowerCase()) ?? [];
    const index = (name: string) => header.indexOf(name);

    for (const [lineIndex, line] of lines.entries()) {
      const cells = line.split(/[;,]/).map((cell) => cell.trim());
      const manufacturerName = cells[index("manufacturer")] || cells[index("tillverkare")];
      const category = cells[index("category")] || cells[index("kategori")] || cells[index("komponenttyp")];
      const modelName = cells[index("modelname")] || cells[index("modell")];

      if (!manufacturerName || !category || !modelName) {
        skippedCount += 1;
        errors.push(`Rad ${lineIndex + 2}: saknar tillverkare/kategori/modell.`);
        continue;
      }

      const manufacturer = await prisma.manufacturer.upsert({
        where: { name: manufacturerName },
        update: {},
        create: { name: manufacturerName },
      });
      const existing = await prisma.productModel.findUnique({
        where: { manufacturerId_category_modelName: { manufacturerId: manufacturer.id, category, modelName } },
      });

      await prisma.productModel.upsert({
        where: { manufacturerId_category_modelName: { manufacturerId: manufacturer.id, category, modelName } },
        update: {
          sourceUrl: cells[index("sourceurl")] || cells[index("källa")] || existing?.sourceUrl,
          manualUrl: cells[index("manualurl")] || existing?.manualUrl,
          wiringDiagramUrl: cells[index("wiringdiagramurl")] || cells[index("elschema")] || existing?.wiringDiagramUrl,
          dataQuality: dataQuality(cells[index("dataquality")] || cells[index("datakvalitet")] || "unverified"),
          lastVerifiedAt: new Date(),
        },
        create: {
          manufacturerId: manufacturer.id,
          category,
          modelName,
          systemType: cells[index("systemtype")] || cells[index("systemtyp")] || null,
          sourceUrl: cells[index("sourceurl")] || cells[index("källa")] || null,
          manualUrl: cells[index("manualurl")] || null,
          wiringDiagramUrl: cells[index("wiringdiagramurl")] || cells[index("elschema")] || null,
          dataQuality: dataQuality(cells[index("dataquality")] || cells[index("datakvalitet")] || "unverified"),
          lastVerifiedAt: new Date(),
        },
      });

      if (existing) updatedCount += 1;
      else createdCount += 1;
    }

    await prisma.productImportLog.update({
      where: { id: log.id },
      data: {
        status: "COMPLETED",
        createdCount,
        updatedCount,
        skippedCount,
        errorCount: errors.length,
        errorDetails: errors.length ? errors : undefined,
        completedAt: new Date(),
      },
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/husstatus-form");
    return { ok: true, message: `CSV importerad. Nya: ${createdCount}, uppdaterade: ${updatedCount}, hoppade över: ${skippedCount}.` };
  } catch {
    await prisma.productImportLog.update({
      where: { id: log.id },
      data: { status: "FAILED", errorCount: errors.length + 1, errorDetails: errors, completedAt: new Date() },
    });
    return { ok: false, message: "CSV-importen avbröts på grund av fel." };
  }
}

export async function startJsEducationImportAction() {
  const log = await prisma.productImportLog.create({
    data: { source: "JS Education", status: "RUNNING" },
  });

  try {
    const result = await importJsEducationIndex({ enrichLimit: 60 });

    await prisma.productImportLog.update({
      where: { id: log.id },
      data: {
        status: "COMPLETED",
        createdCount: result.createdCount,
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        errorCount: result.errorCount,
        errorDetails: result.errorDetails.length ? result.errorDetails : undefined,
        completedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "IMPORT_JS_EDUCATION_PRODUCTS",
        entity: "ProductModel",
        entityId: log.id,
        after: result,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/husstatus-form");
    return {
      ok: true,
      message: `JS Education importerad. Hittade ${result.foundCount} produkter. Nya: ${result.createdCount}, uppdaterade: ${result.updatedCount}.`,
    };
  } catch (error) {
    await prisma.productImportLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorCount: 1,
        errorDetails: [error instanceof Error ? error.message : "Okänt importfel"],
        completedAt: new Date(),
      },
    });

    revalidatePath("/admin/products");
    return { ok: false, message: error instanceof Error ? error.message : "JS Education-importen kunde inte köras." };
  }
}

