import { prisma } from "../../../lib/prisma";
import { productQualityLabels, technicalSummary } from "../../../lib/product-registry";
import AdminSidebar from "../admin-sidebar";
import ProductsView, { type ProductImportLogVm, type ProductModelVm } from "./products-view";

export const dynamic = "force-dynamic";

function priceLabel(min: number | null, max: number | null) {
  if (!min && !max) return "";
  if (min && max && min !== max) return `${min.toLocaleString("sv-SE")}-${max.toLocaleString("sv-SE")} kr`;
  return `${(min ?? max ?? 0).toLocaleString("sv-SE")} kr`;
}

function lifetimeLabel(min: number | null, max: number | null) {
  if (!min && !max) return "Livslängd ej angiven";
  if (min && max && min !== max) return `${min}-${max} år`;
  return `${min ?? max} år`;
}

async function getProductsData(): Promise<{
  databaseOnline: boolean;
  products: ProductModelVm[];
  logs: ProductImportLogVm[];
}> {
  try {
    const [products, logs] = await Promise.all([
      prisma.productModel.findMany({
        include: { manufacturer: true },
        orderBy: [{ active: "desc" }, { category: "asc" }, { modelName: "asc" }],
        take: 2000,
      }),
      prisma.productImportLog.findMany({
        orderBy: { startedAt: "desc" },
        take: 12,
      }),
    ]);

    return {
      databaseOnline: true,
      products: products.map((product) => ({
        id: product.id,
        manufacturer: product.manufacturer.name,
        category: product.category,
        modelName: product.modelName,
        systemType: product.systemType ?? "",
        technicalData: technicalSummary(product),
        lifetime: lifetimeLabel(product.expectedLifetimeMinYears, product.expectedLifetimeMaxYears),
        replacementPrice: priceLabel(product.replacementPriceMinSek, product.replacementPriceMaxSek),
        sourceUrl: product.sourceUrl ?? "",
        manualUrl: product.manualUrl ?? "",
        wiringDiagramUrl: product.wiringDiagramUrl ?? "",
        dataQuality: product.dataQuality,
        lastVerifiedAt: product.lastVerifiedAt?.toLocaleDateString("sv-SE") ?? "Ej verifierad",
        active: product.active,
      })),
      logs: logs.map((log) => ({
        id: log.id,
        source: log.source,
        status: log.status,
        createdCount: log.createdCount,
        updatedCount: log.updatedCount,
        skippedCount: log.skippedCount,
        errorCount: log.errorCount,
        startedAt: log.startedAt.toLocaleString("sv-SE"),
        completedAt: log.completedAt?.toLocaleString("sv-SE") ?? "-",
      })),
    };
  } catch {
    return {
      databaseOnline: false,
      products: [
        {
          id: "LOCAL-IVT-X15",
          manufacturer: "IVT",
          category: "Värmepump",
          modelName: "PremiumLine X15",
          systemType: "Berg-/jord-/sjövärmepump",
          technicalData: "4,5-17 kW / Varvtalsstyrd",
          lifetime: "18-25 år",
          replacementPrice: "190 000-230 000 kr",
          sourceUrl: "https://jseducation.se/product/ivt-premiumline-x15",
          manualUrl: "",
          wiringDiagramUrl: "",
          dataQuality: "estimated",
          lastVerifiedAt: productQualityLabels.estimated,
          active: true,
        },
      ],
      logs: [],
    };
  }
}

export default async function ProductsPage() {
  const data = await getProductsData();

  return (
    <main className="adminShell">
      <AdminSidebar active="products" label="Produktregister" />
      <ProductsView {...data} />
    </main>
  );
}
