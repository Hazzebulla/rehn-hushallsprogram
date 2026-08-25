import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { technicalSummary } from "../../../lib/product-registry";

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
              { category: { contains: q, mode: "insensitive" } },
              { manufacturer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { manufacturer: true },
    orderBy: [{ category: "asc" }, { manufacturer: { name: "asc" } }, { modelName: "asc" }],
    take,
  });

  return NextResponse.json({
    products: products.map((product) => ({
      id: product.id,
      category: product.category,
      manufacturer: product.manufacturer.name,
      modelName: product.modelName,
      systemType: product.systemType,
      technicalData: technicalSummary(product),
      sourceUrl: product.sourceUrl,
      manualUrl: product.manualUrl,
      wiringDiagramUrl: product.wiringDiagramUrl,
      dataQuality: product.dataQuality,
      lastVerifiedAt: product.lastVerifiedAt,
    })),
  });
}
