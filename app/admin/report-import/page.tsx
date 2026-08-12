import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";
import ReportImportView from "./report-import-view";

export const dynamic = "force-dynamic";

async function getProperties() {
  try {
    const properties = await prisma.property.findMany({
      where: { companyId: "org_rehn_vvs" },
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
    });
    return {
      databaseOnline: true,
      properties: properties.map((property) => ({
        id: property.id,
        label: `${property.customer.name} - ${property.propertyNo ?? property.address}`,
      })),
    };
  } catch {
    return {
      databaseOnline: false,
      properties: [{ id: "LOCAL-property", label: "Anna & Erik Svensson - Villa Ängby" }],
    };
  }
}

export default async function ReportImportPage() {
  const data = await getProperties();

  return (
    <main className="adminShell">
      <AdminSidebar active="reportImport" label="Rapportimport" />
      <ReportImportView {...data} />
    </main>
  );
}
