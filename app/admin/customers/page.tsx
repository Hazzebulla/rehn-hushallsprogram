import CustomerRegister from "./register";
import { prisma } from "../../../lib/prisma";
import { ensureExistingCustomerNumbers, type CustomerVm } from "./actions";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

async function getCustomers(): Promise<{ customers: CustomerVm[]; databaseOnline: boolean }> {
  try {
    await ensureExistingCustomerNumbers();

    const customers = await prisma.customer.findMany({
      where: { companyId: "org_rehn_vvs" },
      include: {
        portalAccount: true,
        properties: {
          include: {
            healthScore: true,
            houseReports: {
              orderBy: { updatedAt: "desc" },
              take: 5,
              select: { id: true, status: true, updatedAt: true, performedAt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
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
          customerNumber: customer.customerNumber ?? "",
          name: customer.name,
          identifier: customer.orgOrPersonNo ?? "",
          email: customer.invoiceEmail ?? "",
          phone: customer.phone ?? "",
          property: property?.propertyNo ?? "Fastighet saknas",
          address: property?.address ?? "",
          postalCode: "",
          city: "",
          type: property?.type ?? customer.type,
          buildYear: property?.buildYear ? String(property.buildYear) : "",
          heating: explanation?.heating ?? "Ej angivet",
          profileSourceUrl: explanation?.profileSourceUrl ?? "",
          risk: explanation?.risk ?? 28,
          health: property?.healthScore?.score ?? 74,
          nextAction: explanation?.nextAction ?? "Nästa åtgärd saknas",
          status: customer.portalAccount?.active ? "Publicerad portal" : "Utkast",
          createdAt: customer.createdAt.toLocaleDateString("sv-SE"),
          updatedAt: customer.updatedAt.toLocaleDateString("sv-SE"),
          propertyCount: customer.properties.length,
          reportCount: customer.properties.reduce((count, item) => count + item.houseReports.length, 0),
          latestReportId: customer.properties.flatMap((item) => item.houseReports)[0]?.id ?? "",
          latestReportDate: customer.properties.flatMap((item) => item.houseReports)[0]?.updatedAt.toLocaleDateString("sv-SE") ?? "",
          properties: customer.properties.map((item) => ({
            id: item.id,
            label: item.propertyNo ?? item.address,
            address: item.address,
            type: item.type,
            reportCount: item.houseReports.length,
            latestReportId: item.houseReports[0]?.id ?? "",
            latestReportDate: item.houseReports[0]?.updatedAt.toLocaleDateString("sv-SE") ?? "",
          })),
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
