import { prisma } from "../../../lib/prisma";
import WorkOrdersView from "./workorders-view";
import type { WorkOrderVm } from "./actions";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

const fallbackWorkOrders: WorkOrderVm[] = [
  {
    id: "LOCAL-WO-1",
    projectId: "LOCAL-P-1",
    projectNumber: "P-2026-018",
    title: "Byte expansionskärl",
    customerName: "Anna & Erik Svensson",
    propertyName: "Villa Ängby",
    address: "Björkvägen 12, Bromma",
    priority: "HIGH",
    status: "ASSIGNED",
    scheduledAt: "Ej planerad",
    createdAt: "Demo",
    minutes: 135,
    materialTotalKr: 1850,
  },
  {
    id: "LOCAL-WO-2",
    projectId: "LOCAL-P-2",
    projectNumber: "P-2026-019",
    title: "Vattensäkring kök",
    customerName: "Anna & Erik Svensson",
    propertyName: "Villa Ängby",
    address: "Björkvägen 12, Bromma",
    priority: "NORMAL",
    status: "IN_PROGRESS",
    scheduledAt: "Denna vecka",
    createdAt: "Demo",
    minutes: 240,
    materialTotalKr: 4200,
  },
];

async function getWorkOrders(): Promise<{ workOrders: WorkOrderVm[]; databaseOnline: boolean }> {
  try {
    const workOrders = await prisma.workOrder.findMany({
      where: { companyId: "org_rehn_vvs" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        project: {
          include: {
            customer: true,
            materials: true,
            property: true,
          },
        },
        timeEntries: true,
      },
    });

    const mapped = workOrders.map((workOrder) => ({
      id: workOrder.id,
      projectId: workOrder.projectId,
      projectNumber: workOrder.project.number,
      title: workOrder.title,
      customerName: workOrder.project.customer.name,
      propertyName: workOrder.project.property?.propertyNo ?? "Fastighet saknas",
      address: workOrder.project.property?.address ?? "",
      priority: workOrder.priority,
      status: workOrder.status,
      scheduledAt: workOrder.scheduledAt
        ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeStyle: "short" }).format(workOrder.scheduledAt)
        : "Ej planerad",
      createdAt: new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(
        workOrder.createdAt,
      ),
      minutes: workOrder.timeEntries.reduce((total, entry) => total + entry.minutes, 0),
      materialTotalKr: workOrder.project.materials.reduce((total, entry) => total + entry.salesCents, 0) / 100,
    }));

    return { databaseOnline: true, workOrders: mapped };
  } catch {
    return { databaseOnline: false, workOrders: fallbackWorkOrders };
  }
}

export default async function WorkOrdersPage() {
  const { workOrders, databaseOnline } = await getWorkOrders();

  return (
    <main className="adminShell">
      <AdminSidebar active="workorders" label="Arbetsorder" />
      <WorkOrdersView databaseOnline={databaseOnline} workOrders={workOrders} />
    </main>
  );
}
