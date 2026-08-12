import { prisma } from "../../../lib/prisma";
import GdprView from "./gdpr-view";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

export type GdprVm = {
  id: string;
  type: string;
  status: string;
  customerName: string;
  notes: string;
  createdAt: string;
};

export type GdprCustomer = {
  id: string;
  name: string;
};

async function getGdprData(): Promise<{ databaseOnline: boolean; requests: GdprVm[]; customers: GdprCustomer[] }> {
  try {
    const [requests, customers] = await Promise.all([
      prisma.gdprRequest.findMany({
        where: { companyId: "org_rehn_vvs" },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.customer.findMany({ where: { companyId: "org_rehn_vvs" }, orderBy: { name: "asc" } }),
    ]);

    return {
      databaseOnline: true,
      requests: requests.map((request) => ({
        id: request.id,
        type: request.type,
        status: request.status,
        customerName: request.customer?.name ?? "-",
        notes: request.notes ?? "-",
        createdAt: new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(request.createdAt),
      })),
      customers: customers.map((customer) => ({ id: customer.id, name: customer.name })),
    };
  } catch {
    return {
      databaseOnline: false,
      requests: [],
      customers: [{ id: "LOCAL-cust", name: "Anna & Erik Svensson" }],
    };
  }
}

export default async function GdprPage() {
  const data = await getGdprData();

  return (
    <main className="adminShell">
      <AdminSidebar active="gdpr" label="GDPR" />
      <GdprView {...data} />
    </main>
  );
}
