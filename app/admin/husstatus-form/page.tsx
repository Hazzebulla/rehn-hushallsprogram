import { prisma } from "../../../lib/prisma";
import { technicalSummary } from "../../../lib/product-registry";
import AdminSidebar from "../admin-sidebar";
import HusstatusFormView from "./view";
import { rvmFieldCount, rvmSections } from "./spec";

export const dynamic = "force-dynamic";

function answerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as { value?: unknown; values?: unknown };
  const raw = record.value ?? record.values;
  return raw as string | string[] | Record<string, string>[];
}

function lightenStoredPhotos(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(lightenStoredPhotos);
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === "string" && typeof record.mimeType === "string") {
    return { ...record, dataUrl: "" };
  }

  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, lightenStoredPhotos(item)]));
}

async function getFormData(selectedPropertyId?: string) {
  try {
    const [properties, products] = await Promise.all([
      prisma.property.findMany({
        where: { companyId: "org_rehn_vvs" },
        include: { customer: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.productModel.findMany({
        where: { active: true },
        include: {
          manufacturer: true,
          supplierProducts: {
            where: { active: true },
            select: {
              supplierArticleNumber: true,
              rskNumber: true,
              supplierName: true,
              calculationGroup: true,
              unit: true,
            },
            take: 3,
          },
        },
        orderBy: [{ category: "asc" }, { modelName: "asc" }],
        take: 2500,
      }),
    ]);
    const propertyId = selectedPropertyId || properties[0]?.id;
    const draftSubmission = propertyId
      ? await prisma.formSubmission.findFirst({
          where: {
            companyId: "org_rehn_vvs",
            status: "DRAFT",
            inspection: { propertyId, companyId: "org_rehn_vvs" },
          },
          include: { answers: true },
          orderBy: { updatedAt: "desc" },
        })
      : null;
    const completedSubmission = propertyId
      ? await prisma.formSubmission.findFirst({
          where: {
            companyId: "org_rehn_vvs",
            status: { not: "DRAFT" },
            inspection: { propertyId, companyId: "org_rehn_vvs" },
          },
          include: { answers: true },
          orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
        })
      : null;
    const latestSubmission = draftSubmission ?? completedSubmission;

    return {
      databaseOnline: true,
      initialPropertyId: propertyId,
      initialStatus: latestSubmission?.status ?? "NOT_STARTED",
      initialAnswers: Object.fromEntries(
        latestSubmission?.answers.map((answer) => [answer.fieldKey, lightenStoredPhotos(answerValue(answer.value))]) ?? [],
      ) as Record<string, unknown>,
      properties: properties.map((property) => ({
        id: property.id,
        label: `${property.customer.name} - ${property.propertyNo ?? property.address}`,
        customerName: property.customer.name,
        customerPhone: property.customer.phone ?? "",
        customerEmail: property.customer.invoiceEmail ?? "",
        customerIdentifier: property.customer.orgOrPersonNo ?? "",
        propertyNo: property.propertyNo ?? "",
        address: property.address,
        propertyType: property.type,
        buildYear: property.buildYear,
      })),
      products: products.map((product) => ({
        id: product.id,
        category: product.category,
        manufacturer: product.manufacturer.name,
        rskNumber: product.rskNumber ?? "",
        productName: product.productName ?? "",
        modelName: product.modelName,
        unit: product.unit,
        systemType: product.systemType ?? "",
        technicalData: technicalSummary(product),
        expectedLifetimeMinYears: product.expectedLifetimeMinYears,
        expectedLifetimeMaxYears: product.expectedLifetimeMaxYears,
        replacementPriceMinSek: product.replacementPriceMinSek,
        replacementPriceMaxSek: product.replacementPriceMaxSek,
        sourceUrl: product.sourceUrl ?? "",
        manualUrl: product.manualUrl ?? "",
        wiringDiagramUrl: product.wiringDiagramUrl ?? "",
        dataQuality: product.dataQuality,
        supplierProducts: product.supplierProducts,
      })),
    };
  } catch {
    return {
      databaseOnline: false,
      initialPropertyId: selectedPropertyId,
      initialStatus: "NOT_STARTED",
      initialAnswers: {},
      properties: [{
        id: "LOCAL-property",
        label: "Anna & Erik Svensson - Villa Ängby",
        customerName: "Anna & Erik Svensson",
        customerPhone: "",
        customerEmail: "",
        customerIdentifier: "",
        propertyNo: "",
        address: "Villa Ängby",
        propertyType: "Villa",
        buildYear: null,
      }],
      products: [],
    };
  }
}

export default async function HusstatusFormPage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const data = await getFormData(params?.propertyId);

  return (
    <main className="adminShell">
      <AdminSidebar active="husstatusForm" label="Fyll i formulär" />
      <HusstatusFormView {...data} fieldCount={rvmFieldCount} sections={rvmSections} />
    </main>
  );
}
