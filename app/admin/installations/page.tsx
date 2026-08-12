import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";
import InstallationsView from "./installations-view";
import type { ComponentVm, InstallationPropertyOption } from "./actions";

export const dynamic = "force-dynamic";

const fallbackComponents: ComponentVm[] = [
  {
    id: "LOCAL-COMP-1",
    propertyName: "Villa Ängby",
    systemName: "Värmesystem",
    typeName: "Expansionskärl",
    category: "Värmesystem",
    brand: "Reflex",
    model: "N 18",
    serialNo: "RX-N18-2010-445",
    installedYear: "2010",
    normalLifeYears: 15,
    status: "RED",
    condition: "Åldrad",
    riskLevel: "HIGH",
    criticality: "HIGH",
    plannedReplacementYear: 2025,
    replacementCostKr: 7500,
  },
];

async function getInstallationsData(): Promise<{
  databaseOnline: boolean;
  properties: InstallationPropertyOption[];
  components: ComponentVm[];
}> {
  try {
    const [properties, components] = await Promise.all([
      prisma.property.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.component.findMany({
        where: { companyId: "org_rehn_vvs" },
        include: {
          property: true,
          system: true,
          type: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 80,
      }),
    ]);

    return {
      databaseOnline: true,
      properties: properties.map((property) => ({
        id: property.id,
        label: `${property.propertyNo ?? "Fastighet"} - ${property.address}`,
      })),
      components: components.map((component) => ({
        id: component.id,
        propertyName: component.property.propertyNo ?? component.property.address,
        systemName: component.system?.name ?? "-",
        typeName: component.type.name,
        category: component.type.category,
        brand: component.brand ?? "-",
        model: component.model ?? "-",
        serialNo: component.serialNo ?? "-",
        installedYear: component.estimatedYear?.toString() ?? "-",
        normalLifeYears: component.type.normalLifeYears,
        status: component.status,
        condition: component.condition,
        riskLevel: component.riskLevel,
        criticality: component.criticality,
        plannedReplacementYear: component.plannedReplacementYear,
        replacementCostKr: Math.round(component.replacementCostCents / 100),
      })),
    };
  } catch {
    return {
      databaseOnline: false,
      properties: [{ id: "LOCAL-property", label: "Villa Ängby - Björkvägen 12" }],
      components: fallbackComponents,
    };
  }
}

export default async function InstallationsPage() {
  const data = await getInstallationsData();

  return (
    <main className="adminShell">
      <AdminSidebar active="installations" label="Installationer" />
      <InstallationsView {...data} />
    </main>
  );
}
