"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export type CustomerVm = {
  id: string;
  name: string;
  email: string;
  phone: string;
  property: string;
  address: string;
  type: string;
  heating: string;
  risk: number;
  health: number;
  nextAction: string;
  status: string;
};

type CustomerInput = Omit<CustomerVm, "id" | "risk" | "health" | "status">;

type ActionResult =
  | { ok: true; customer: CustomerVm; message: string }
  | { ok: false; message: string };

async function ensureCompany() {
  return prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { name: "Rehn VVS & Montage i Timrå AB", orgNo: "559000-0000" },
    create: {
      id: COMPANY_ID,
      name: "Rehn VVS & Montage i Timrå AB",
      orgNo: "559000-0000",
    },
  });
}

export async function createCustomerAction(input: CustomerInput): Promise<ActionResult> {
  try {
    await ensureCompany();

    const health = input.type === "BRF" ? 68 : 79;
    const risk = input.type === "BRF" ? 36 : 22;

    const customer = await prisma.customer.create({
      data: {
        companyId: COMPANY_ID,
        type: input.type,
        name: input.name,
        invoiceEmail: input.email,
        phone: input.phone || null,
        properties: {
          create: {
            companyId: COMPANY_ID,
            type: input.type,
            address: input.address,
            propertyNo: input.property,
            healthScore: {
              create: {
                companyId: COMPANY_ID,
                score: health,
                explanation: {
                  risk,
                  heating: input.heating,
                  nextAction: input.nextAction,
                  source: "admin_customer_form",
                },
              },
            },
          },
        },
        portalAccount: {
          create: {
            companyId: COMPANY_ID,
            email: input.email,
            active: false,
          },
        },
      },
      include: {
        properties: { include: { healthScore: true }, take: 1 },
      },
    });

    const property = customer.properties[0];

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "CREATE_CUSTOMER_WITH_PROPERTY",
        entity: "Customer",
        entityId: customer.id,
        after: {
          customerName: customer.name,
          propertyId: property?.id,
          propertyName: input.property,
          nextAction: input.nextAction,
        },
      },
    });

    revalidatePath("/admin/customers");

    return {
      ok: true,
      message: "Kund och fastighet sparades i databasen.",
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.invoiceEmail ?? input.email,
        phone: customer.phone ?? "",
        property: property?.propertyNo ?? input.property,
        address: property?.address ?? input.address,
        type: property?.type ?? input.type,
        heating: input.heating,
        risk,
        health,
        nextAction: input.nextAction,
        status: "Utkast",
      },
    };
  } catch {
    return {
      ok: false,
      message: "Databasen är inte nåbar. Kunden sparades bara lokalt i demo-vyn.",
    };
  }
}

export async function publishCustomerToPortalAction(customerId: string): Promise<ActionResult> {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId: COMPANY_ID },
      include: { portalAccount: true, properties: { include: { healthScore: true }, take: 1 } },
    });

    if (!customer) {
      return { ok: false, message: "Kunden finns inte i databasen." };
    }

    await prisma.customerPortalAccount.upsert({
      where: { customerId: customer.id },
      update: { active: true },
      create: {
        companyId: COMPANY_ID,
        customerId: customer.id,
        email: customer.invoiceEmail ?? "kund@example.se",
        active: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "PUBLISH_CUSTOMER_PORTAL",
        entity: "Customer",
        entityId: customer.id,
        after: { portalActive: true },
      },
    });

    revalidatePath("/admin/customers");
    revalidatePath("/portal");

    const property = customer.properties[0];
    const explanation = property?.healthScore?.explanation as
      | { risk?: number; heating?: string; nextAction?: string }
      | undefined;

    return {
      ok: true,
      message: "Kunden publicerades till kundportalen.",
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.invoiceEmail ?? "",
        phone: customer.phone ?? "",
        property: property?.propertyNo ?? "Fastighet",
        address: property?.address ?? "",
        type: property?.type ?? customer.type,
        heating: explanation?.heating ?? "Ej angivet",
        risk: explanation?.risk ?? 28,
        health: property?.healthScore?.score ?? 74,
        nextAction: explanation?.nextAction ?? "Nästa åtgärd saknas",
        status: "Publicerad portal",
      },
    };
  } catch {
    return {
      ok: false,
      message: "Databasen är inte nåbar. Publiceringen visas bara lokalt i demo-vyn.",
    };
  }
}
