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
