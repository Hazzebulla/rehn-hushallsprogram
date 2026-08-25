import { prisma } from "./prisma";

export type SupplierProductCatalogInput = {
  companyId: string;
  supplierId: string;
  supplierName: string;
  supplierArticleNumber: string;
  rskNumber?: string | null;
  calculationGroup?: string | null;
  unit?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || null;
}

function inferDahlCategory(input: SupplierProductCatalogInput) {
  const text = `${input.supplierName} ${input.calculationGroup ?? ""}`.toLowerCase();
  if (/\b(wc|toalett|spolknapp|fixtur|tvättställ|blandare|dusch|badkar)\b/.test(text)) return "Sanitet";
  if (/\b(avlopp|brunn|mark|drän|dran|dagvatten)\b/.test(text)) return "Avlopp";
  if (/\b(värme|varme|elpanna|värmepump|varmepump|nibe|bosch|ctc|pump|radiator)\b/.test(text)) return "Värmesystem";
  if (/\b(rör|ror|koppling|ventil|pem|pex|cu|stål|stal)\b/.test(text)) return "Rör & kopplingar";
  return normalizeText(input.calculationGroup) || "Dahl produktregister";
}

function productModelName(input: SupplierProductCatalogInput) {
  const name = normalizeText(input.supplierName) || "Dahl-produkt";
  return `${name} (${input.supplierArticleNumber})`;
}

function supplierProductKey(input: Pick<SupplierProductCatalogInput, "supplierId" | "supplierArticleNumber">) {
  return `${input.supplierId}:${normalizeText(input.supplierArticleNumber)}`;
}

function centralProductFields(input: SupplierProductCatalogInput, manufacturerId: string) {
  const supplierName = normalizeText(input.supplierName) || "Dahl-produkt";
  const supplierArticleNumber = normalizeText(input.supplierArticleNumber) || "okänd";
  const category = inferDahlCategory({ ...input, supplierName, supplierArticleNumber });
  const modelName = productModelName({ ...input, supplierName, supplierArticleNumber });

  return {
    manufacturerId,
    rskNumber: normalizeText(input.rskNumber),
    productName: supplierName,
    category,
    modelName,
    unit: normalizeText(input.unit) || "st",
    technicalDescription: [
      `Importerad från Dahl artikel ${supplierArticleNumber}.`,
      input.calculationGroup ? `Kalkylgrupp: ${input.calculationGroup}.` : null,
    ].filter(Boolean).join(" "),
    dataQuality: "supplier_source" as const,
    active: true,
  };
}

export async function ensureCentralProductsForSupplierProducts(inputs: SupplierProductCatalogInput[]) {
  const validInputs = Array.from(new Map(inputs
    .map((input) => ({
      ...input,
      supplierName: normalizeText(input.supplierName) || "",
      supplierArticleNumber: normalizeText(input.supplierArticleNumber) || "",
    }))
    .filter((input) => input.companyId && input.supplierId && input.supplierName && input.supplierArticleNumber)
    .map((input) => [supplierProductKey(input), input])).values());

  const productModelIds = new Map<string, string>();
  if (validInputs.length === 0) return { productModelIds, createdProductCount: 0 };

  const companyId = validInputs[0].companyId;
  const supplierIds = Array.from(new Set(validInputs.map((input) => input.supplierId)));
  const articleNumbers = Array.from(new Set(validInputs.map((input) => input.supplierArticleNumber)));

  const existingSupplierProducts = await prisma.supplierProduct.findMany({
    where: {
      companyId,
      supplierId: { in: supplierIds },
      supplierArticleNumber: { in: articleNumbers },
      productModelId: { not: null },
    },
    select: { supplierId: true, supplierArticleNumber: true, productModelId: true },
  });
  for (const supplierProduct of existingSupplierProducts) {
    if (supplierProduct.productModelId) productModelIds.set(supplierProductKey(supplierProduct), supplierProduct.productModelId);
  }

  const rskNumbers = Array.from(new Set(validInputs.map((input) => normalizeText(input.rskNumber)).filter(Boolean) as string[]));
  const existingByRsk = rskNumbers.length
    ? await prisma.productModel.findMany({
        where: { active: true, rskNumber: { in: rskNumbers } },
        select: { id: true, rskNumber: true },
      })
    : [];
  const productIdByRsk = new Map(existingByRsk.map((product) => [product.rskNumber, product.id]));
  for (const input of validInputs) {
    const rskNumber = normalizeText(input.rskNumber);
    const productId = rskNumber ? productIdByRsk.get(rskNumber) : null;
    if (productId && !productModelIds.has(supplierProductKey(input))) productModelIds.set(supplierProductKey(input), productId);
  }

  const manufacturer = await prisma.manufacturer.upsert({
    where: { name: "Dahl" },
    update: {},
    create: { name: "Dahl", website: "https://www.dahl.se" },
  });

  const unresolved = validInputs.filter((input) => !productModelIds.has(supplierProductKey(input)));
  const productFields = unresolved.map((input) => centralProductFields(input, manufacturer.id));
  const categories = Array.from(new Set(productFields.map((product) => product.category)));
  const modelNames = Array.from(new Set(productFields.map((product) => product.modelName)));
  const existingByName = productFields.length
    ? await prisma.productModel.findMany({
        where: { manufacturerId: manufacturer.id, category: { in: categories }, modelName: { in: modelNames } },
        select: { id: true, category: true, modelName: true },
      })
    : [];
  const productIdByName = new Map(existingByName.map((product) => [`${product.category}:${product.modelName}`, product.id]));
  const missingProducts = productFields.filter((product) => !productIdByName.has(`${product.category}:${product.modelName}`));

  if (missingProducts.length) {
    await prisma.productModel.createMany({ data: missingProducts, skipDuplicates: true });
  }

  const allCreatedOrExisting = productFields.length
    ? await prisma.productModel.findMany({
        where: { manufacturerId: manufacturer.id, category: { in: categories }, modelName: { in: modelNames } },
        select: { id: true, category: true, modelName: true },
      })
    : [];
  const productIdByUnique = new Map(allCreatedOrExisting.map((product) => [`${product.category}:${product.modelName}`, product.id]));
  for (const input of unresolved) {
    const fields = centralProductFields(input, manufacturer.id);
    const productId = productIdByUnique.get(`${fields.category}:${fields.modelName}`);
    if (productId) productModelIds.set(supplierProductKey(input), productId);
  }

  return { productModelIds, createdProductCount: missingProducts.length };
}

export async function ensureCentralProductForSupplierProduct(input: SupplierProductCatalogInput) {
  const supplierName = normalizeText(input.supplierName);
  const supplierArticleNumber = normalizeText(input.supplierArticleNumber);
  if (!supplierName || !supplierArticleNumber) return { productModelId: null, createdProduct: false };

  const existingSupplierProduct = await prisma.supplierProduct.findUnique({
    where: {
      companyId_supplierId_supplierArticleNumber: {
        companyId: input.companyId,
        supplierId: input.supplierId,
        supplierArticleNumber,
      },
    },
    select: { productModelId: true },
  });
  if (existingSupplierProduct?.productModelId) return { productModelId: existingSupplierProduct.productModelId, createdProduct: false };

  const rskNumber = normalizeText(input.rskNumber);
  if (rskNumber) {
    const existingByRsk = await prisma.productModel.findFirst({
      where: { rskNumber, active: true },
      select: { id: true },
    });
    if (existingByRsk) return { productModelId: existingByRsk.id, createdProduct: false };
  }

  const manufacturer = await prisma.manufacturer.upsert({
    where: { name: "Dahl" },
    update: {},
    create: { name: "Dahl", website: "https://www.dahl.se" },
  });
  const category = inferDahlCategory({ ...input, supplierName, supplierArticleNumber });
  const modelName = productModelName({ ...input, supplierName, supplierArticleNumber });

  const existingByName = await prisma.productModel.findUnique({
    where: {
      manufacturerId_category_modelName: {
        manufacturerId: manufacturer.id,
        category,
        modelName,
      },
    },
    select: { id: true },
  });
  if (existingByName) return { productModelId: existingByName.id, createdProduct: false };

  const product = await prisma.productModel.create({
    data: centralProductFields({ ...input, supplierName, supplierArticleNumber }, manufacturer.id),
    select: { id: true },
  });

  return { productModelId: product.id, createdProduct: true };
}
