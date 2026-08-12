import { prisma } from "../../../lib/prisma";
import InvoicingView from "./invoicing-view";
import type { InvoiceProjectVm } from "./actions";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

const fallbackProjects: InvoiceProjectVm[] = [
  {
    id: "LOCAL-P-1",
    number: "P-2026-018",
    name: "Byte expansionskärl",
    customerName: "Anna & Erik Svensson",
    propertyName: "Villa Ängby",
    status: "READY_FOR_INVOICING",
    minutes: 135,
    timeTotalKr: 1913,
    materialTotalKr: 1850,
    totalKr: 3763,
    invoiceStatus: "Ej skapat",
    invoiceId: null,
  },
  {
    id: "LOCAL-P-2",
    number: "P-2026-019",
    name: "Vattensäkring kök",
    customerName: "Anna & Erik Svensson",
    propertyName: "Villa Ängby",
    status: "ACTIVE",
    minutes: 240,
    timeTotalKr: 3400,
    materialTotalKr: 4200,
    totalKr: 7600,
    invoiceStatus: "Ej skapat",
    invoiceId: null,
  },
];

async function getInvoiceProjects(): Promise<{ projects: InvoiceProjectVm[]; databaseOnline: boolean }> {
  try {
    const projects = await prisma.project.findMany({
      where: { companyId: "org_rehn_vvs" },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        customer: true,
        property: true,
        timeEntries: true,
        materials: true,
        invoices: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const mapped = projects.map((project) => {
      const minutes = project.timeEntries.reduce((total, entry) => total + entry.minutes, 0);
      const timeTotalKr = Math.round((minutes / 60) * 850);
      const materialTotalKr = project.materials.reduce((total, entry) => total + entry.salesCents, 0) / 100;
      const invoice = project.invoices[0] ?? null;

      return {
        id: project.id,
        number: project.number,
        name: project.name,
        customerName: project.customer.name,
        propertyName: project.property?.propertyNo ?? "Fastighet saknas",
        status: project.status,
        minutes,
        timeTotalKr,
        materialTotalKr,
        totalKr: timeTotalKr + materialTotalKr,
        invoiceStatus: invoice?.status ?? "Ej skapat",
        invoiceId: invoice?.id ?? null,
      };
    });

    return { databaseOnline: true, projects: mapped };
  } catch {
    return { databaseOnline: false, projects: fallbackProjects };
  }
}

export default async function InvoicingPage() {
  const { projects, databaseOnline } = await getInvoiceProjects();

  return (
    <main className="adminShell">
      <AdminSidebar active="invoicing" label="Fakturaunderlag" />
      <InvoicingView databaseOnline={databaseOnline} projects={projects} />
    </main>
  );
}
