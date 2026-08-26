import { NextRequest, NextResponse } from "next/server";
import { defaultPricingSettings } from "../../../lib/pricing-engine";
import { prisma } from "../../../lib/prisma";
import { technicalSummary } from "../../../lib/product-registry";
import { getCurrentSessionUser } from "../../../lib/session";

function priceNumber(priceRawValue: string | null | undefined, price: unknown) {
  const parsedRaw = Number(String(priceRawValue ?? "").replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(parsedRaw) && parsedRaw > 0) return parsedRaw;
  const parsedPrice = Number(price);
  return Number.isFinite(parsedPrice) ? parsedPrice : null;
}

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

function priceStatus(validTo: Date | null | undefined) {
  if (!validTo) return "Okänd";
  const daysLeft = Math.ceil((validTo.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return "Utgången";
  if (daysLeft <= 45) return "Löper snart ut";
  return "Aktiv";
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSessionUser();
  if (!session || session.role === "CUSTOMER") {
    return NextResponse.json({ products: [] }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const manufacturer = searchParams.get("manufacturer")?.trim();
  const hasDocuments = searchParams.get("hasDocuments") === "true";
  const take = Math.min(Number(searchParams.get("take") ?? 200) || 200, 500);

  const companyId = session.companyId;
  const [settings, markupRules, discountRules, products] = await Promise.all([
    prisma.pricingSettings.findUnique({ where: { companyId } }),
    prisma.materialMarkupRule.findMany({
      where: { companyId, active: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.supplierDiscountRule.findMany({
      where: { companyId, active: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.productModel.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
      ...(manufacturer ? { manufacturer: { name: manufacturer } } : {}),
      ...(hasDocuments ? { OR: [{ manualUrl: { not: null } }, { wiringDiagramUrl: { not: null } }] } : {}),
      ...(q
        ? {
            OR: [
              { modelName: { contains: q, mode: "insensitive" } },
              { productName: { contains: q, mode: "insensitive" } },
              { rskNumber: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { manufacturer: { name: { contains: q, mode: "insensitive" } } },
              {
                supplierProducts: {
                  some: {
                    OR: [
                      { supplierArticleNumber: { contains: q, mode: "insensitive" } },
                      { supplierName: { contains: q, mode: "insensitive" } },
                      { calculationGroup: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      manufacturer: true,
      supplierProducts: {
        where: { active: true },
        include: {
          supplier: { select: { id: true, name: true } },
          prices: {
            include: { priceList: { select: { code: true, validFrom: true, validTo: true } } },
            orderBy: [{ validTo: "desc" }, { importedAt: "desc" }],
            take: 1,
          },
        },
      },
    },
    orderBy: [{ category: "asc" }, { manufacturer: { name: "asc" } }, { modelName: "asc" }],
    take,
    }),
  ]);
  const pricingSettings = settings ?? defaultPricingSettings;

  return NextResponse.json({
    products: products.map((product) => {
      const productMarkup = markupRules.find((rule) => rule.productModelId === product.id);
      const categoryMarkup = markupRules.find((rule) => !rule.productModelId && rule.category && sameText(rule.category, product.category));
      const markupPercent = Number(productMarkup?.markupPercent ?? categoryMarkup?.markupPercent ?? pricingSettings.materialMarkupPercent);
      const supplierProducts = product.supplierProducts.map((supplierProduct) => {
        const latestPrice = supplierProduct.prices[0];
        const listPrice = latestPrice ? priceNumber(latestPrice.priceRawValue, latestPrice.price) : null;
        const discountRule = discountRules.find((rule) =>
          (rule.rskNumber && (sameText(rule.rskNumber, product.rskNumber) || sameText(rule.rskNumber, supplierProduct.rskNumber)))
          || (rule.discountGroupCode && sameText(rule.discountGroupCode, supplierProduct.calculationGroup))
          || (rule.productGroup && sameText(rule.productGroup, supplierProduct.calculationGroup))
          || (rule.category && sameText(rule.category, product.category))
          || (rule.manufacturerName && sameText(rule.manufacturerName, product.manufacturer.name))
          || (rule.supplierId && rule.supplierId === supplierProduct.supplierId)
        );
        const discountPercent = Number(discountRule?.discountPercent ?? 0);
        const netPrice = listPrice === null ? null : Math.round(listPrice * (1 - discountPercent / 100) * 100) / 100;
        const customerPrice = netPrice === null ? null : Math.round(netPrice * (1 + markupPercent / 100) * 100) / 100;

        return {
          id: supplierProduct.id,
          supplierId: supplierProduct.supplierId,
          supplier: supplierProduct.supplier.name,
          supplierArticleNumber: supplierProduct.supplierArticleNumber,
          rskNumber: supplierProduct.rskNumber,
          supplierName: supplierProduct.supplierName,
          calculationGroup: supplierProduct.calculationGroup,
          unit: supplierProduct.unit,
          statusRaw: supplierProduct.statusRaw,
          latestPrice: latestPrice
            ? {
                listPrice,
                price: listPrice,
                rawPrice: Number(latestPrice.price),
                validFrom: latestPrice.validFrom,
                validTo: latestPrice.validTo,
                priceListCode: latestPrice.priceList.code,
                priceStatus: priceStatus(latestPrice.validTo),
                priceExpired: latestPrice.validTo ? latestPrice.validTo.getTime() < Date.now() : false,
                discountPercent,
                netPrice,
                markupPercent,
                customerPrice,
                discountRuleId: discountRule?.id ?? null,
              }
            : null,
        };
      });

      return {
      id: product.id,
      category: product.category,
      manufacturer: product.manufacturer.name,
      rskNumber: product.rskNumber,
      productName: product.productName,
      modelName: product.modelName,
      unit: product.unit,
      systemType: product.systemType,
      technicalData: technicalSummary(product),
      sourceUrl: product.sourceUrl,
      manualUrl: product.manualUrl,
      wiringDiagramUrl: product.wiringDiagramUrl,
      dataQuality: product.dataQuality,
      lastVerifiedAt: product.lastVerifiedAt,
      supplierProducts,
      primaryPrice: supplierProducts.find((supplierProduct) => supplierProduct.latestPrice)?.latestPrice ?? null,
      };
    }),
  });
}
