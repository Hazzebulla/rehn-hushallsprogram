import { prisma } from "../../../lib/prisma";
import RequestsView from "./requests-view";
import type { RequestVm } from "./actions";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

const fallbackRequests: RequestVm[] = [
  {
    id: "LOCAL-REQ-1",
    category: "Offertförfrågan",
    priority: "NORMAL",
    status: "NEW",
    description: "Kunden vill ha offert på byte av expansionskärl.",
    customerName: "Anna & Erik Svensson",
    propertyName: "Villa Ängby",
    address: "Björkvägen 12, Bromma",
    createdAt: "Demo",
  },
  {
    id: "LOCAL-REQ-2",
    category: "Felanmälan",
    priority: "HIGH",
    status: "NEW",
    description: "Återkommande tryckfall i värmesystemet.",
    customerName: "Anna & Erik Svensson",
    propertyName: "Villa Ängby",
    address: "Björkvägen 12, Bromma",
    createdAt: "Demo",
  },
];

async function getRequests(): Promise<{ requests: RequestVm[]; databaseOnline: boolean }> {
  try {
    const requests = await prisma.customerRequest.findMany({
      where: { companyId: "org_rehn_vvs" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const mapped = await Promise.all(
      requests.map(async (request) => {
        const [customer, property] = await Promise.all([
          prisma.customer.findFirst({ where: { id: request.customerId, companyId: request.companyId } }),
          request.propertyId
            ? prisma.property.findFirst({ where: { id: request.propertyId, companyId: request.companyId } })
            : Promise.resolve(null),
        ]);

        return {
          id: request.id,
          category: request.category,
          priority: request.priority,
          status: request.status,
          description: request.description,
          customerName: customer?.name ?? "Okänd kund",
          propertyName: property?.propertyNo ?? "Fastighet saknas",
          address: property?.address ?? "",
          createdAt: new Intl.DateTimeFormat("sv-SE", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(request.createdAt),
        };
      }),
    );

    return { databaseOnline: true, requests: mapped.length ? mapped : fallbackRequests };
  } catch {
    return { databaseOnline: false, requests: fallbackRequests };
  }
}

export default async function RequestsPage() {
  const { requests, databaseOnline } = await getRequests();

  return (
    <main className="adminShell">
      <AdminSidebar active="requests" label="Ärendeinkorg" />
      <RequestsView databaseOnline={databaseOnline} requests={requests} />
    </main>
  );
}
