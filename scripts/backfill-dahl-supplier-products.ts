import { prisma } from "../lib/prisma";
import { ensureCentralProductsForSupplierProducts } from "../lib/supplier-product-catalog";

async function main() {
  const suppliers = await prisma.supplier.findMany({
    where: { name: { equals: "Dahl", mode: "insensitive" } },
    select: { id: true, companyId: true, name: true },
  });

  let scanned = 0;
  let linked = 0;
  let createdCentralProducts = 0;
  let skipped = 0;

  for (const supplier of suppliers) {
    const supplierProducts = await prisma.supplierProduct.findMany({
      where: {
        companyId: supplier.companyId,
        supplierId: supplier.id,
        active: true,
      },
      orderBy: { createdAt: "asc" },
    });

    scanned += supplierProducts.length;
    const centralProducts = await ensureCentralProductsForSupplierProducts(supplierProducts.map((supplierProduct) => ({
        companyId: supplierProduct.companyId,
        supplierId: supplierProduct.supplierId,
        supplierArticleNumber: supplierProduct.supplierArticleNumber,
        supplierName: supplierProduct.supplierName,
        rskNumber: supplierProduct.rskNumber,
        calculationGroup: supplierProduct.calculationGroup,
        unit: supplierProduct.unit,
      })));
    createdCentralProducts += centralProducts.createdProductCount;

    for (const supplierProduct of supplierProducts) {
      const productModelId = centralProducts.productModelIds.get(`${supplierProduct.supplierId}:${supplierProduct.supplierArticleNumber}`);
      if (!productModelId) {
        skipped += 1;
        continue;
      }

      if (supplierProduct.productModelId !== productModelId) {
        await prisma.supplierProduct.update({
          where: { id: supplierProduct.id },
          data: { productModelId },
        });
        linked += 1;
      }
    }
  }

  console.log(JSON.stringify({ scanned, linked, createdCentralProducts, skipped }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
