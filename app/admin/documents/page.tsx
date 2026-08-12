import { prisma } from "../../../lib/prisma";
import DocumentsView from "./documents-view";
import type { DocumentOption, DocumentVm } from "./actions";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

const fallbackDocuments: DocumentVm[] = [
  {
    id: "doc_husrapport_demo",
    title: "RVM Husstatus Premium Rapport",
    fileName: "rvm-husstatus-premium-rapport.pdf",
    mimeType: "application/pdf",
    sizeKb: 2000,
    visibility: "CUSTOMER",
    version: 1,
    customerName: "Anna & Erik Svensson",
    propertyName: "Villa Ängby",
    projectNumber: "-",
    createdAt: "Demo",
    downloadUrl: "/husrapport",
  },
];

async function getDocumentData(): Promise<{
  databaseOnline: boolean;
  documents: DocumentVm[];
  customers: DocumentOption[];
  properties: DocumentOption[];
  projects: DocumentOption[];
}> {
  try {
    const [documents, customers, properties, projects] = await Promise.all([
      prisma.documentAsset.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { customer: true, property: true, project: true },
      }),
      prisma.customer.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { name: "asc" },
      }),
      prisma.property.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.project.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return {
      databaseOnline: true,
      documents: documents.map((document) => ({
        id: document.id,
        title: document.title,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeKb: Math.max(1, Math.round(document.sizeBytes / 1024)),
        visibility: document.visibility,
        version: document.version,
        customerName: document.customer?.name ?? "-",
        propertyName: document.property?.propertyNo ?? "-",
        projectNumber: document.project?.number ?? "-",
        createdAt: new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(
          document.createdAt,
        ),
        downloadUrl: document.id === "doc_husrapport_demo"
          ? document.propertyId
            ? `/husrapport?propertyId=${document.propertyId}`
            : "/husrapport"
          : `/api/documents/${document.id}`,
      })),
      customers: customers.map((customer) => ({ id: customer.id, label: customer.name })),
      properties: properties.map((property) => ({ id: property.id, label: `${property.propertyNo ?? "Fastighet"} - ${property.address}` })),
      projects: projects.map((project) => ({ id: project.id, label: `${project.number} - ${project.name}` })),
    };
  } catch {
    return {
      databaseOnline: false,
      documents: fallbackDocuments,
      customers: [{ id: "LOCAL-cust", label: "Anna & Erik Svensson" }],
      properties: [{ id: "LOCAL-property", label: "Villa Ängby - Björkvägen 12" }],
      projects: [],
    };
  }
}

export default async function DocumentsPage() {
  const data = await getDocumentData();

  return (
    <main className="adminShell">
      <AdminSidebar active="documents" label="Dokument" />
      <DocumentsView {...data} />
    </main>
  );
}
