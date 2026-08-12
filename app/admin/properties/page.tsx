import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";
import PropertiesView from "./properties-view";
import type { PropertyCustomerOption, PropertyVm } from "./actions";

export const dynamic = "force-dynamic";

const fallbackProperties: PropertyVm[] = [
  {
    id: "LOCAL-PROP-1",
    customerId: "LOCAL-cust",
    customerName: "Anna & Erik Svensson",
    propertyNo: "Villa Ängby",
    type: "Villa",
    address: "Björkvägen 12, Bromma",
    buildYear: 1978,
    health: 74,
    risk: 28,
    nextAction: "Byt expansionskärl",
    systems: 2,
    documents: 1,
    projects: 0,
    createdAt: "Demo",
  },
];

async function getPropertyData(): Promise<{
  properties: PropertyVm[];
  customers: PropertyCustomerOption[];
  databaseOnline: boolean;
}> {
  try {
    const [properties, customers] = await Promise.all([
      prisma.property.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { updatedAt: "desc" },
        include: {
          customer: true,
          healthScore: true,
          systems: true,
          documents: true,
          projects: true,
        },
      }),
      prisma.customer.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      databaseOnline: true,
      properties: properties.map((property) => {
        const explanation = property.healthScore?.explanation as
          | { risk?: number; nextAction?: string }
          | undefined;

        return {
          id: property.id,
          customerId: property.customerId,
          customerName: property.customer.name,
          propertyNo: property.propertyNo ?? "Fastighet",
          type: property.type,
          address: property.address,
          buildYear: property.buildYear,
          health: property.healthScore?.score ?? 74,
          risk: explanation?.risk ?? 28,
          nextAction: explanation?.nextAction ?? "Första genomgång saknas",
          systems: property.systems.length,
          documents: property.documents.length,
          projects: property.projects.length,
          createdAt: new Intl.DateTimeFormat("sv-SE", { dateStyle: "short" }).format(property.createdAt),
        };
      }),
      customers: customers.map((customer) => ({ id: customer.id, name: customer.name })),
    };
  } catch {
    return {
      databaseOnline: false,
      properties: fallbackProperties,
      customers: [{ id: "LOCAL-cust", name: "Anna & Erik Svensson" }],
    };
  }
}

export default async function PropertiesPage() {
  const data = await getPropertyData();

  return (
    <main className="adminShell">
      <AdminSidebar active="properties" label="Fastighetsregister" />
      <PropertiesView {...data} />
    </main>
  );
}
