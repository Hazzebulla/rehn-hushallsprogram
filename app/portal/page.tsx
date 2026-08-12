import { prisma } from "../../lib/prisma";
import { extractHusstatusImages } from "../../lib/husstatus-images";
import PortalView, { type PortalVm } from "./portal-view";
import { rvmSections } from "../admin/husstatus-form/spec";

export const dynamic = "force-dynamic";

const fallbackPortal: PortalVm = {
  customerId: "LOCAL-cust",
  propertyId: "LOCAL-property",
  customerName: "Anna & Erik Svensson",
  propertyName: "Villa Ängby",
  address: "Björkvägen 12, Bromma",
  health: 74,
  risk: 28,
  nextAction: "Byt expansionskärl",
  databaseOnline: false,
  docs: [
    { title: "RVM Husstatus Premium Rapport", url: "/husrapport" },
    { title: "Egenkontroll", url: "/" },
    { title: "Offert 2026-081", url: "/" },
    { title: "Serviceavtal utkast", url: "/" },
  ],
  images: [],
  properties: [],
};

async function getPortalData(selectedPropertyId?: string): Promise<PortalVm> {
  try {
    const accounts = await prisma.customerPortalAccount.findMany({
      where: { companyId: "org_rehn_vvs", active: true },
      include: {
        customer: {
          include: {
            documents: { where: { visibility: "CUSTOMER" }, orderBy: { createdAt: "desc" }, take: 10 },
            properties: { include: { healthScore: true }, orderBy: { updatedAt: "desc" } },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    if (!accounts.length) return fallbackPortal;

    const properties = accounts.flatMap((account) =>
      account.customer.properties.map((property) => ({
        customerId: account.customerId,
        customerName: account.customer.name,
        id: property.id,
        label: property.propertyNo ?? property.address,
        address: property.address,
      })),
    );

    const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? properties[0];
    const account = accounts.find((item) => item.customerId === selectedProperty?.customerId) ?? accounts[0];
    const property = account.customer.properties.find((item) => item.id === selectedProperty?.id) ?? account.customer.properties[0];
    const reportUrl = property?.id ? `/husrapport?propertyId=${property.id}` : "/husrapport";
    const explanation = property?.healthScore?.explanation as
      | { risk?: number; nextAction?: string }
      | undefined;

    const submissions = property?.id
      ? await prisma.formSubmission.findMany({
          where: {
            companyId: "org_rehn_vvs",
            inspection: {
              propertyId: property.id,
              property: { customerId: account.customerId },
            },
          },
          include: {
            answers: true,
            inspection: {
              include: {
                property: {
                  include: { customer: true },
                },
              },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 10,
        })
      : [];
    const images = extractHusstatusImages(submissions, rvmSections)
      .filter((image) => image.visibility === "CUSTOMER")
      .slice(0, 12)
      .map((image) => ({
        id: image.id,
        title: image.fieldLabel,
        section: image.sectionTitle,
        src: image.dataUrl,
      }));

    return {
      customerId: account.customerId,
      propertyId: property?.id,
      customerName: account.customer.name,
      propertyName: property?.propertyNo ?? "Fastighet",
      address: property?.address ?? "",
      health: property?.healthScore?.score ?? 74,
      risk: explanation?.risk ?? 28,
      nextAction: explanation?.nextAction ?? "Nästa åtgärd saknas",
      databaseOnline: true,
      docs: account.customer.documents.length
        ? account.customer.documents.map((document) => ({
            title: document.title,
            url: document.id === "doc_husrapport_demo" ? reportUrl : `/api/documents/${document.id}`,
          }))
        : [{ title: "RVM Husstatus Premium Rapport", url: reportUrl }, ...fallbackPortal.docs.slice(1)],
      images,
      properties,
    };
  } catch {
    return fallbackPortal;
  }
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const data = await getPortalData(params?.propertyId);
  return <PortalView data={data} />;
}
