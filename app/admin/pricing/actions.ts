"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { calculateEstimate } from "../../../lib/pricing-engine";
import { getCurrentSessionUser } from "../../../lib/session";

const COMPANY_ID = "org_rehn_vvs";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function decimal(value: FormDataEntryValue | null) {
  const parsed = Number(text(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function intOre(value: FormDataEntryValue | null) {
  return Math.max(0, Math.round(decimal(value) * 100));
}

function int(value: FormDataEntryValue | null) {
  return Math.max(0, Math.round(decimal(value)));
}

function cleanScope(value: string | null | undefined) {
  const cleaned = String(value ?? "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function splitImportLine(line: string) {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  if (line.includes(";")) return line.split(";").map((cell) => cell.trim());
  return line.split(",").map((cell) => cell.trim());
}

function headerIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header));
}

type ParsedDiscountRule = {
  supplierId: string | null;
  manufacturerName: string | null;
  category: string | null;
  productGroup: string | null;
  rskNumber: string | null;
  discountPercent: number;
  sourceNote: string | null;
};

function parseDiscountPercent(value: string) {
  const match = value.match(/(\d{1,3}(?:[,.]\d{1,3})?)\s*%?/);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}

function supplierIdFromText(line: string, suppliers: Array<{ id: string; name: string }>, fallbackSupplierId: string | null) {
  const lower = line.toLowerCase();
  return suppliers.find((supplier) => lower.includes(supplier.name.toLowerCase()))?.id ?? fallbackSupplierId;
}

function categoryFromText(value: string) {
  const categories = [
    "Blandare",
    "Värmepump",
    "Pump",
    "Rördelar",
    "Sanitet",
    "Värmesystem",
    "Tappvatten",
    "Avlopp",
    "Golvvärme",
    "Ventiler",
    "WC",
  ];
  const lower = value.toLowerCase();
  return categories.find((category) => lower.includes(category.toLowerCase())) ?? null;
}

function parseDiscountRows(rawText: string, suppliers: Array<{ id: string; name: string }>, fallbackSupplierId: string | null, sourceName: string) {
  const rows: ParsedDiscountRule[] = [];
  const lines = rawText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return rows;

  const firstCells = splitImportLine(lines[0]).map((cell) => cell.toLowerCase());
  const hasHeader = firstCells.some((cell) => ["rabatt", "discount", "rabatt%", "discountpercent"].includes(cell));

  if (hasHeader) {
    const headers = firstCells.map((cell) => cell.replace(/\s+/g, ""));
    const supplierIndex = headerIndex(headers, ["leverantör", "leverantor", "supplier"]);
    const manufacturerIndex = headerIndex(headers, ["tillverkare", "manufacturer", "fabrikat"]);
    const categoryIndex = headerIndex(headers, ["kategori", "category"]);
    const productGroupIndex = headerIndex(headers, ["produktgrupp", "productgroup", "grupp"]);
    const rskIndex = headerIndex(headers, ["rsk", "rsknummer", "rsknumber"]);
    const discountIndex = headerIndex(headers, ["rabatt", "rabatt%", "discount", "discountpercent"]);

    for (const line of lines.slice(1)) {
      const cells = splitImportLine(line);
      const discountPercent = parseDiscountPercent(cells[discountIndex] ?? "");
      if (discountPercent === null) continue;
      const supplierText = supplierIndex >= 0 ? cells[supplierIndex] : "";
      rows.push({
        supplierId: supplierIdFromText(supplierText, suppliers, fallbackSupplierId),
        manufacturerName: cleanScope(cells[manufacturerIndex]),
        category: cleanScope(cells[categoryIndex]),
        productGroup: cleanScope(cells[productGroupIndex]),
        rskNumber: cleanScope(cells[rskIndex]),
        discountPercent,
        sourceNote: `Importerad från ${sourceName}`,
      });
    }
    return rows;
  }

  for (const line of lines) {
    const discountPercent = parseDiscountPercent(line);
    if (discountPercent === null) continue;
    const rskNumber = line.match(/\b\d{6,8}\b/)?.[0] ?? null;
    const supplierId = supplierIdFromText(line, suppliers, fallbackSupplierId);
    const withoutNoise = line
      .replace(/(\d{1,3}(?:[,.]\d{1,3})?)\s*%/g, "")
      .replace(/\b\d{6,8}\b/g, "")
      .replace(/rabatt|discount|leverantör|leverantor|supplier|rsk|:/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const supplier = suppliers.find((item) => item.id === supplierId);
    const cleaned = supplier ? withoutNoise.replace(new RegExp(supplier.name, "i"), "").trim() : withoutNoise;
    const category = categoryFromText(cleaned);
    const manufacturerName = rskNumber ? null : cleanScope(category ? cleaned.replace(new RegExp(category, "i"), "") : cleaned);

    rows.push({
      supplierId,
      manufacturerName,
      category,
      productGroup: null,
      rskNumber,
      discountPercent,
      sourceNote: `Importerad från ${sourceName}: ${line.slice(0, 140)}`,
    });
  }

  return rows;
}

async function textFromDiscountImportFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  if (
    lowerName.endsWith(".xlsx")
    || lowerName.endsWith(".xls")
    || file.type.includes("spreadsheet")
    || file.type.includes("excel")
  ) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: false });
    return workbook.SheetNames
      .map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return "";
        return XLSX.utils.sheet_to_csv(sheet, { FS: ";", blankrows: false });
      })
      .filter(Boolean)
      .join("\n");
  }
  if (file.type.includes("pdf") || lowerName.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: bytes });
    const parsed = await parser.getText();
    await parser.destroy();
    return parsed.text;
  }
  return file.text();
}

async function requireInternalUser() {
  const user = await getCurrentSessionUser();
  if (!user || user.role === "CUSTOMER") throw new Error("Saknar behörighet.");
  return user;
}

export async function savePricingSettingsAction(formData: FormData) {
  const user = await requireInternalUser();

  await prisma.pricingSettings.upsert({
    where: { companyId: user.companyId || COMPANY_ID },
    update: {
      preferredSupplierId: text(formData.get("preferredSupplierId")) || null,
      autoSelectLowestNetPrice: text(formData.get("autoSelectLowestNetPrice")) === "on",
      standardHourlyRateOre: intOre(formData.get("standardHourlyRateSek")),
      materialMarkupPercent: decimal(formData.get("materialMarkupPercent")),
      serviceVehicleFeeOre: intOre(formData.get("serviceVehicleFeeSek")),
      minimumBillingMinutes: int(formData.get("minimumBillingMinutes")),
      vatPercent: decimal(formData.get("vatPercent")),
      rotEnabledByDefault: text(formData.get("rotEnabledByDefault")) === "on",
      rotDeductionPercent: decimal(formData.get("rotDeductionPercent")),
      rotMaxDeductionOre: intOre(formData.get("rotMaxDeductionSek")),
      customerRoundingIncrementOre: intOre(formData.get("customerRoundingIncrementSek")) || 100,
      estimateValidityDays: int(formData.get("estimateValidityDays")) || 30,
    },
    create: {
      companyId: user.companyId || COMPANY_ID,
      preferredSupplierId: text(formData.get("preferredSupplierId")) || null,
      autoSelectLowestNetPrice: text(formData.get("autoSelectLowestNetPrice")) === "on",
      standardHourlyRateOre: intOre(formData.get("standardHourlyRateSek")),
      materialMarkupPercent: decimal(formData.get("materialMarkupPercent")),
      serviceVehicleFeeOre: intOre(formData.get("serviceVehicleFeeSek")),
      minimumBillingMinutes: int(formData.get("minimumBillingMinutes")),
      vatPercent: decimal(formData.get("vatPercent")),
      rotEnabledByDefault: text(formData.get("rotEnabledByDefault")) === "on",
      rotDeductionPercent: decimal(formData.get("rotDeductionPercent")),
      rotMaxDeductionOre: intOre(formData.get("rotMaxDeductionSek")),
      customerRoundingIncrementOre: intOre(formData.get("customerRoundingIncrementSek")) || 100,
      estimateValidityDays: int(formData.get("estimateValidityDays")) || 30,
    },
  });

  revalidatePath("/admin/pricing");
}

export async function createSupplierAction(formData: FormData) {
  const user = await requireInternalUser();
  const name = text(formData.get("name"));
  if (!name) return;

  await prisma.supplier.upsert({
    where: { companyId_name: { companyId: user.companyId || COMPANY_ID, name } },
    update: { active: true },
    create: { companyId: user.companyId || COMPANY_ID, name },
  });

  revalidatePath("/admin/pricing");
}

export async function createSupplierPriceAction(formData: FormData) {
  const user = await requireInternalUser();
  const productModelId = text(formData.get("productModelId"));
  const supplierId = text(formData.get("supplierId"));
  const listPriceOre = intOre(formData.get("listPriceSek"));
  if (!productModelId || !supplierId || listPriceOre <= 0) return;

  await prisma.productSupplierPrice.upsert({
    where: { companyId_productModelId_supplierId: { companyId: user.companyId || COMPANY_ID, productModelId, supplierId } },
    update: {
      supplierSku: text(formData.get("supplierSku")) || null,
      listPriceOre,
      unit: text(formData.get("unit")) || "st",
      sourceNote: text(formData.get("sourceNote")) || null,
      active: true,
    },
    create: {
      companyId: user.companyId || COMPANY_ID,
      productModelId,
      supplierId,
      supplierSku: text(formData.get("supplierSku")) || null,
      listPriceOre,
      unit: text(formData.get("unit")) || "st",
      sourceNote: text(formData.get("sourceNote")) || null,
    },
  });

  revalidatePath("/admin/pricing");
}

export async function createDiscountRuleAction(formData: FormData) {
  const user = await requireInternalUser();

  await prisma.supplierDiscountRule.create({
    data: {
      companyId: user.companyId || COMPANY_ID,
      supplierId: text(formData.get("supplierId")) || null,
      manufacturerName: text(formData.get("manufacturerName")) || null,
      category: text(formData.get("category")) || null,
      productGroup: text(formData.get("productGroup")) || null,
      rskNumber: text(formData.get("rskNumber")) || null,
      discountPercent: decimal(formData.get("discountPercent")),
      sourceNote: text(formData.get("sourceNote")) || null,
    },
  });

  revalidatePath("/admin/pricing");
}

export async function importDiscountLetterAction(formData: FormData) {
  const user = await requireInternalUser();
  const companyId = user.companyId || COMPANY_ID;
  const fallbackSupplierId = text(formData.get("supplierId")) || null;
  const pastedText = text(formData.get("discountText"));
  const file = formData.get("file");

  let rawText = pastedText;
  let sourceName = "inklistrad text";

  if (file instanceof File && file.size > 0) {
    rawText = await textFromDiscountImportFile(file);
    sourceName = file.name;
  }

  if (!rawText.trim()) return;

  const suppliers = await prisma.supplier.findMany({
    where: { companyId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const parsedRows = parseDiscountRows(rawText, suppliers, fallbackSupplierId, sourceName)
    .filter((row) => row.discountPercent >= 0 && row.discountPercent <= 100)
    .filter((row) => row.supplierId || row.manufacturerName || row.category || row.productGroup || row.rskNumber);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of parsedRows.slice(0, 500)) {
    const existing = await prisma.supplierDiscountRule.findFirst({
      where: {
        companyId,
        supplierId: row.supplierId,
        manufacturerName: row.manufacturerName,
        category: row.category,
        productGroup: row.productGroup,
        rskNumber: row.rskNumber,
        active: true,
      },
    });

    if (existing) {
      await prisma.supplierDiscountRule.update({
        where: { id: existing.id },
        data: {
          discountPercent: row.discountPercent,
          sourceNote: row.sourceNote,
        },
      });
      updated += 1;
    } else {
      await prisma.supplierDiscountRule.create({
        data: {
          companyId,
          supplierId: row.supplierId,
          manufacturerName: row.manufacturerName,
          category: row.category,
          productGroup: row.productGroup,
          rskNumber: row.rskNumber,
          discountPercent: row.discountPercent,
          sourceNote: row.sourceNote,
        },
      });
      created += 1;
    }
  }

  skipped = Math.max(0, parsedRows.length - created - updated);

  await prisma.productImportLog.create({
    data: {
      source: `Rabattbrev: ${sourceName}`,
      status: "COMPLETED",
      createdCount: created,
      updatedCount: updated,
      skippedCount: skipped,
      completedAt: new Date(),
      errorDetails: parsedRows.length ? undefined : ["Inga tydliga rabattregler hittades."],
      errorCount: parsedRows.length ? 0 : 1,
    },
  });

  revalidatePath("/admin/pricing");
}

export async function createMarkupRuleAction(formData: FormData) {
  const user = await requireInternalUser();

  await prisma.materialMarkupRule.create({
    data: {
      companyId: user.companyId || COMPANY_ID,
      productModelId: text(formData.get("productModelId")) || null,
      category: text(formData.get("category")) || null,
      markupPercent: decimal(formData.get("markupPercent")),
    },
  });

  revalidatePath("/admin/pricing");
}

export async function createActionTemplateAction(formData: FormData) {
  const user = await requireInternalUser();
  const name = text(formData.get("name"));
  if (!name) return;

  await prisma.actionTemplate.upsert({
    where: { companyId_name: { companyId: user.companyId || COMPANY_ID, name } },
    update: {
      category: text(formData.get("category")) || "Övrigt",
      description: text(formData.get("description")) || null,
      defaultWorkMinutes: int(formData.get("defaultWorkMinutes")) || 60,
      defaultConsumablesOre: intOre(formData.get("defaultConsumablesSek")),
      defaultOtherCostOre: intOre(formData.get("defaultOtherCostSek")),
      recommendedProductModelId: text(formData.get("recommendedProductModelId")) || null,
      rotEligible: text(formData.get("rotEligible")) === "on",
      requiresQuote: text(formData.get("requiresQuote")) === "on",
      active: true,
    },
    create: {
      companyId: user.companyId || COMPANY_ID,
      name,
      category: text(formData.get("category")) || "Övrigt",
      description: text(formData.get("description")) || null,
      defaultWorkMinutes: int(formData.get("defaultWorkMinutes")) || 60,
      defaultConsumablesOre: intOre(formData.get("defaultConsumablesSek")),
      defaultOtherCostOre: intOre(formData.get("defaultOtherCostSek")),
      recommendedProductModelId: text(formData.get("recommendedProductModelId")) || null,
      rotEligible: text(formData.get("rotEligible")) === "on",
      requiresQuote: text(formData.get("requiresQuote")) === "on",
    },
  });

  revalidatePath("/admin/pricing");
}

export async function createDemoEstimateAction(formData: FormData) {
  const user = await requireInternalUser();
  const reportId = text(formData.get("reportId"));
  const templateId = text(formData.get("templateId"));
  const productModelId = text(formData.get("productModelId"));
  if (!reportId || !templateId) return;

  const [settings, template, product, discounts, markups] = await Promise.all([
    prisma.pricingSettings.findUnique({ where: { companyId: user.companyId || COMPANY_ID } }),
    prisma.actionTemplate.findFirst({ where: { id: templateId, companyId: user.companyId || COMPANY_ID } }),
    productModelId
      ? prisma.productModel.findFirst({
          where: { id: productModelId },
          include: { manufacturer: true, supplierPrices: { where: { companyId: user.companyId || COMPANY_ID, active: true }, include: { supplier: true } } },
        })
      : null,
    prisma.supplierDiscountRule.findMany({ where: { companyId: user.companyId || COMPANY_ID, active: true }, include: { supplier: true } }),
    prisma.materialMarkupRule.findMany({ where: { companyId: user.companyId || COMPANY_ID, active: true } }),
  ]);

  if (!template) return;

  const calculation = calculateEstimate(
    {
      title: template.name,
      rotSelected: text(formData.get("rotSelected")) === "yes" ? "yes" : text(formData.get("rotSelected")) === "no" ? "no" : "unknown",
      requiresQuote: template.requiresQuote,
      materialLines: product
        ? [{
            description: product.productName || `${product.manufacturer.name} ${product.modelName}`,
            rskNumber: product.rskNumber,
            quantity: decimal(formData.get("quantity")) || 1,
            product: {
              id: product.id,
              rskNumber: product.rskNumber,
              name: product.productName || product.modelName,
              manufacturerName: product.manufacturer.name,
              category: product.category,
              unit: product.unit,
            },
            supplierPrices: product.supplierPrices.map((price) => ({
              id: price.id,
              supplierId: price.supplierId,
              supplierName: price.supplier.name,
              listPriceOre: price.listPriceOre,
              unit: price.unit,
            })),
          }]
        : [],
      laborLines: [{
        workType: "VVS-montör",
        minutes: int(formData.get("workMinutes")) || template.defaultWorkMinutes,
        standardMinutes: template.defaultWorkMinutes,
        rotEligible: template.rotEligible,
      }],
      otherCostLines: [
        { description: "Servicebil", quantity: 1, unitPriceOre: settings?.serviceVehicleFeeOre ?? 49500 },
        ...(template.defaultConsumablesOre > 0 ? [{ description: "Förbrukningsmaterial", quantity: 1, unitPriceOre: template.defaultConsumablesOre }] : []),
        ...(template.defaultOtherCostOre > 0 ? [{ description: "Övrig fast avgift", quantity: 1, unitPriceOre: template.defaultOtherCostOre }] : []),
      ],
    },
    settings ? {
      preferredSupplierId: settings.preferredSupplierId,
      autoSelectLowestNetPrice: settings.autoSelectLowestNetPrice,
      standardHourlyRateOre: settings.standardHourlyRateOre,
      materialMarkupPercent: Number(settings.materialMarkupPercent),
      serviceVehicleFeeOre: settings.serviceVehicleFeeOre,
      minimumBillingMinutes: settings.minimumBillingMinutes,
      vatPercent: Number(settings.vatPercent),
      rotEnabledByDefault: settings.rotEnabledByDefault,
      rotDeductionPercent: Number(settings.rotDeductionPercent),
      rotMaxDeductionOre: settings.rotMaxDeductionOre,
      customerRoundingIncrementOre: settings.customerRoundingIncrementOre,
      estimateValidityDays: settings.estimateValidityDays,
    } : {},
    discounts.map((rule) => ({
      id: rule.id,
      supplierId: rule.supplierId,
      supplierName: rule.supplier?.name ?? null,
      manufacturerName: rule.manufacturerName,
      category: rule.category,
      productGroup: rule.productGroup,
      rskNumber: rule.rskNumber,
      discountPercent: Number(rule.discountPercent),
    })),
    markups.map((rule) => ({
      id: rule.id,
      productModelId: rule.productModelId,
      category: rule.category,
      markupPercent: Number(rule.markupPercent),
    })),
  );

  await prisma.actionEstimate.create({
    data: {
      companyId: user.companyId || COMPANY_ID,
      reportId,
      actionTemplateId: template.id,
      title: template.name,
      status: calculation.warnings.length ? "needs_review" : "draft",
      requiresQuote: template.requiresQuote,
      rotSelected: text(formData.get("rotSelected")) || "unknown",
      snapshot: calculation.snapshot as Prisma.InputJsonValue,
      subtotalOre: calculation.subtotalOre,
      vatOre: calculation.vatOre,
      totalInclVatOre: calculation.totalInclVatOre,
      rotDeductionOre: calculation.rotDeductionOre,
      customerTotalOre: calculation.customerTotalOre,
      materialRows: {
        create: calculation.materialLines.map((line) => ({
          companyId: user.companyId || COMPANY_ID,
          productModelId: product?.id ?? null,
          description: line.description,
          rskNumber: line.rskNumber,
          quantity: line.quantity,
          unit: line.unit,
          supplierName: line.supplierName,
          listPriceOreAtEstimate: line.listPriceOre,
          discountPercentAtEstimate: line.discountPercent,
          netPriceOreAtEstimate: line.netPriceOre,
          markupPercentAtEstimate: line.markupPercent,
          customerUnitPriceOreAtEstimate: line.customerUnitPriceOre,
          totalCustomerPriceOre: line.totalCustomerPriceOre,
          snapshot: line as Prisma.InputJsonValue,
        })),
      },
      laborRows: {
        create: calculation.laborLines.map((line) => ({
          companyId: user.companyId || COMPANY_ID,
          workType: line.workType,
          minutes: line.minutes,
          standardMinutes: line.standardMinutes,
          hourlyRateOreAtEstimate: line.hourlyRateOre,
          rotEligible: line.rotEligible,
          totalOre: line.totalOre,
          snapshot: line as Prisma.InputJsonValue,
        })),
      },
      otherCostRows: {
        create: calculation.otherCostLines.map((line) => ({
          companyId: user.companyId || COMPANY_ID,
          description: line.description,
          quantity: line.quantity,
          unitPriceOreAtEstimate: line.unitPriceOre,
          totalOre: line.totalOre,
          rotEligible: Boolean(line.rotEligible),
          snapshot: line as Prisma.InputJsonValue,
        })),
      },
    },
  });

  revalidatePath("/admin/pricing");
}
