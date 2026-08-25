import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { technicalSummary } from "../../../lib/product-registry";

function priceNumber(priceRawValue: string | null | undefined, price: unknown) {
  const parsedRaw = Number(String(priceRawValue ?? "").replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(parsedRaw) && parsedRaw > 0) return parsedRaw;
  const parsedPrice = Number(price);
  return Number.isFinite(parsedPrice) ? parsedPrice : null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const manufacturer = searchParams.get("manufacturer")?.trim();
  const hasDocuments = searchParams.get("hasDocuments") === "true";
  const take = Math.min(Number(searchParams.get("take") ?? 200) || 200, 500);

  const products = await prisma.productModel.findMany({
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
  });

  return NextResponse.json({
    products: products.map((product) => ({
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
      supplierProducts: product.supplierProducts.map((supplierProduct) => {
        const latestPrice = supplierProduct.prices[0];
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
                price: priceNumber(latestPrice.priceRawValue, latestPrice.price),
                rawPrice: Number(latestPrice.price),
                validFrom: latestPrice.validFrom,
                validTo: latestPrice.validTo,
                priceListCode: latestPrice.priceList.code,
              }
            : null,
        };
      }),
    })),
  });
}
