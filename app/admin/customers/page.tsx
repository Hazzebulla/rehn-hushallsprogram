import CustomerRegister from "./register";
import { prisma } from "../../../lib/prisma";
import type { CustomerVm } from "./actions";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

async function getCustomers(): Promise<{ customers: CustomerVm[]; databaseOnline: boolean }> {
  try {
    const customers = await prisma.customer.findMany({
      where: { companyId: "org_rehn_vvs" },
      include: {
        portalAccount: true,
        properties: {
          include: { healthScore: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return {
      databaseOnline: true,
      customers: customers.map((customer) => {
        const property = customer.properties[0];
        const explanation = property?.healthScore?.explanation as
          | { risk?: number; heating?: string; nextAction?: string; profileSourceUrl?: string }
          | undefined;

        return {
          id: customer.id,
          name: customer.name,
          identifier: customer.orgOrPersonNo ?? "",
          email: customer.invoiceEmail ?? "",
          phone: customer.phone ?? "",
          property: property?.propertyNo ?? "Fastighet saknas",
          address: property?.address ?? "",
          type: property?.type ?? customer.type,
          buildYear: property?.buildYear ? String(property.buildYear) : "",
          heating: explanation?.heating ?? "Ej angivet",
          profileSourceUrl: explanation?.profileSourceUrl ?? "",
          risk: explanation?.risk ?? 28,
          health: property?.healthScore?.score ?? 74,
          nextAction: explanation?.nextAction ?? "Nästa åtgärd saknas",
          status: customer.portalAccount?.active ? "Publicerad portal" : "Utkast",
        };
      }),
    };
  } catch {
    return { customers: [], databaseOnline: false };
  }
}

export default async function CustomersPage() {
  const { customers, databaseOnline } = await getCustomers();

  return (
    <main className="adminShell">
      <AdminSidebar active="customers" label="Kund- och fastighetsdata" />
      <CustomerRegister databaseOnline={databaseOnline} initialCustomers={customers} />
    </main>
  );
}
