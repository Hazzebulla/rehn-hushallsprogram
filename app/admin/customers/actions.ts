"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export type CustomerVm = {
  id: string;
  customerNumber: string;
  name: string;
  identifier: string;
  email: string;
  phone: string;
  property: string;
  address: string;
  postalCode: string;
  city: string;
  type: string;
  buildYear: string;
  heating: string;
  profileSourceUrl: string;
  risk: number;
  health: number;
  nextAction: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  propertyCount: number;
  reportCount: number;
  latestReportId: string;
  latestReportDate: string;
  properties: Array<{
    id: string;
    label: string;
    address: string;
    type: string;
    reportCount: number;
    latestReportId: string;
    latestReportDate: string;
  }>;
};

export type CustomerInput = {
  name: string;
  identifier: string;
  email: string;
  phone: string;
  property: string;
  address: string;
  postalCode: string;
  city: string;
  type: string;
  buildYear: string;
  heating: string;
  profileSourceUrl: string;
  nextAction: string;
};

type ActionResult =
  | { ok: true; customer: CustomerVm; message: string }
  | { ok: false; message: string };

export type DeleteCustomerResult =
  | { ok: true; deletedCustomerId: string; message: string }
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

function formatCustomerNumber(value: number) {
  return String(value).padStart(6, "0");
}

function numericCustomerNumber(value: string | null | undefined) {
  const number = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

async function nextCustomerNumber(tx: Prisma.TransactionClient) {
  const latestCustomer = await tx.customer.findFirst({
    where: { companyId: COMPANY_ID, customerNumber: { not: null } },
    orderBy: { customerNumber: "desc" },
    select: { customerNumber: true },
  });
  const minimumNextValue = Math.max(100001, numericCustomerNumber(latestCustomer?.customerNumber) + 1);

  const sequence = await tx.numberSequence.upsert({
    where: { companyId_scope: { companyId: COMPANY_ID, scope: "customer_number" } },
    update: {},
    create: { companyId: COMPANY_ID, scope: "customer_number", nextValue: minimumNextValue },
    select: { nextValue: true },
  });

  if (sequence.nextValue < minimumNextValue) {
    await tx.numberSequence.update({
      where: { companyId_scope: { companyId: COMPANY_ID, scope: "customer_number" } },
      data: { nextValue: minimumNextValue },
    });
  }

  const updatedSequence = await tx.numberSequence.update({
    where: { companyId_scope: { companyId: COMPANY_ID, scope: "customer_number" } },
    data: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });

  return formatCustomerNumber(updatedSequence.nextValue - 1);
}

export async function ensureExistingCustomerNumbers() {
  try {
    await prisma.$transaction(async (tx) => {
      const customers = await tx.customer.findMany({
        where: { companyId: COMPANY_ID, customerNumber: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!customers.length) return;

      const latestCustomer = await tx.customer.findFirst({
        where: { companyId: COMPANY_ID, customerNumber: { not: null } },
        orderBy: { customerNumber: "desc" },
        select: { customerNumber: true },
      });
      const startValue = Math.max(100001, numericCustomerNumber(latestCustomer?.customerNumber) + 1);
      const nextValue = startValue + customers.length;

      const sequence = await tx.numberSequence.upsert({
        where: { companyId_scope: { companyId: COMPANY_ID, scope: "customer_number" } },
        update: {},
        create: { companyId: COMPANY_ID, scope: "customer_number", nextValue },
        select: { nextValue: true },
      });

      const effectiveStart = Math.max(startValue, sequence.nextValue);

      for (const [index, customer] of customers.entries()) {
        await tx.customer.update({
          where: { id: customer.id },
          data: { customerNumber: formatCustomerNumber(effectiveStart + index) },
        });
      }

      await tx.numberSequence.update({
        where: { companyId_scope: { companyId: COMPANY_ID, scope: "customer_number" } },
        data: { nextValue: effectiveStart + customers.length },
      });
    }, { timeout: 20000 });
  } catch (error) {
    console.error("Customer number backfill failed", error);
  }
}

export async function createCustomerAction(input: CustomerInput): Promise<ActionResult> {
  try {
    await ensureCompany();

    const health = input.type === "BRF" ? 68 : 79;
    const risk = input.type === "BRF" ? 36 : 22;

    const customer = await prisma.$transaction(async (tx) => tx.customer.create({
      data: {
        companyId: COMPANY_ID,
        customerNumber: await nextCustomerNumber(tx),
        type: input.type,
        name: input.name,
        orgOrPersonNo: input.identifier || null,
        invoiceEmail: input.email,
        phone: input.phone || null,
        properties: {
          create: {
            companyId: COMPANY_ID,
            type: input.type,
            address: input.address,
            propertyNo: input.property,
            buildYear: input.buildYear ? Number(input.buildYear) : null,
            healthScore: {
              create: {
                companyId: COMPANY_ID,
                score: health,
                explanation: {
                  risk,
                  heating: input.heating,
                  nextAction: input.nextAction,
                  profileSourceUrl: input.profileSourceUrl,
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
    }));

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
          identifier: input.identifier,
          propertyId: property?.id,
          propertyName: input.property,
          buildYear: input.buildYear,
          profileSourceUrl: input.profileSourceUrl,
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
        customerNumber: customer.customerNumber ?? "",
        name: customer.name,
        identifier: customer.orgOrPersonNo ?? input.identifier,
        email: customer.invoiceEmail ?? input.email,
        phone: customer.phone ?? "",
        property: property?.propertyNo ?? input.property,
        address: property?.address ?? input.address,
        postalCode: input.postalCode ?? "",
        city: input.city ?? "",
        type: property?.type ?? input.type,
        buildYear: property?.buildYear ? String(property.buildYear) : input.buildYear,
        heating: input.heating,
        profileSourceUrl: input.profileSourceUrl,
        risk,
        health,
        nextAction: input.nextAction,
        status: "Utkast",
        createdAt: customer.createdAt.toLocaleDateString("sv-SE"),
        updatedAt: customer.updatedAt.toLocaleDateString("sv-SE"),
        propertyCount: customer.properties.length,
        reportCount: 0,
        latestReportId: "",
        latestReportDate: "",
        properties: property ? [{
          id: property.id,
          label: property.propertyNo ?? input.property,
          address: property.address,
          type: property.type,
          reportCount: 0,
          latestReportId: "",
          latestReportDate: "",
        }] : [],
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
      | { risk?: number; heating?: string; nextAction?: string; profileSourceUrl?: string }
      | undefined;

    return {
      ok: true,
      message: "Kunden publicerades till kundportalen.",
      customer: {
        id: customer.id,
        customerNumber: customer.customerNumber ?? "",
        name: customer.name,
        identifier: customer.orgOrPersonNo ?? "",
        email: customer.invoiceEmail ?? "",
        phone: customer.phone ?? "",
        property: property?.propertyNo ?? "Fastighet",
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
        status: "Publicerad portal",
        createdAt: customer.createdAt.toLocaleDateString("sv-SE"),
        updatedAt: customer.updatedAt.toLocaleDateString("sv-SE"),
        propertyCount: customer.properties.length,
        reportCount: 0,
        latestReportId: "",
        latestReportDate: "",
        properties: property ? [{
          id: property.id,
          label: property.propertyNo ?? "Fastighet",
          address: property.address,
          type: property.type,
          reportCount: 0,
          latestReportId: "",
          latestReportDate: "",
        }] : [],
      },
    };
  } catch {
    return {
      ok: false,
      message: "Databasen är inte nåbar. Publiceringen visas bara lokalt i demo-vyn.",
    };
  }
}

export async function deleteCustomerAction(customerId: string): Promise<DeleteCustomerResult> {
  if (!customerId) return { ok: false, message: "Kund-ID saknas." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, companyId: COMPANY_ID },
        select: {
          id: true,
          name: true,
          projects: { select: { id: true, number: true }, take: 3 },
          properties: { select: { id: true } },
        },
      });

      if (!customer) {
        return { ok: false as const, message: "Kunden finns inte i databasen." };
      }

      if (customer.projects.length > 0) {
        return {
          ok: false as const,
          message:
            "Kunden har projekt/order kopplade till sig. Radera eller arkivera projektet först så att historik och ekonomi inte försvinner av misstag.",
        };
      }

      const acceptedQuoteCount = await tx.quote.count({
        where: {
          companyId: COMPANY_ID,
          customerId: customer.id,
          OR: [{ acceptedAt: { not: null } }, { status: { in: ["ACCEPTED", "APPROVED"] } }],
        },
      });

      if (acceptedQuoteCount > 0) {
        return {
          ok: false as const,
          message:
            "Kunden har accepterade offerter. De måste hanteras som historik/GDPR-ärende istället för direkt radering.",
        };
      }

      const propertyIds = customer.properties.map((property) => property.id);
      const reports = propertyIds.length
        ? await tx.houseReport.findMany({
            where: { companyId: COMPANY_ID, propertyId: { in: propertyIds } },
            select: { id: true, submissionId: true },
          })
        : [];
      const inspections = propertyIds.length
        ? await tx.inspection.findMany({
            where: { companyId: COMPANY_ID, propertyId: { in: propertyIds } },
            select: { id: true, submissions: { select: { id: true } } },
          })
        : [];
      const components = propertyIds.length
        ? await tx.component.findMany({
            where: { companyId: COMPANY_ID, propertyId: { in: propertyIds } },
            select: { id: true },
          })
        : [];
      const plans = propertyIds.length
        ? await tx.maintenancePlan.findMany({
            where: { companyId: COMPANY_ID, propertyId: { in: propertyIds } },
            select: { id: true },
          })
        : [];

      const reportIds = reports.map((report) => report.id);
      const inspectionIds = inspections.map((inspection) => inspection.id);
      const submissionIds = Array.from(new Set([
        ...reports.map((report) => report.submissionId),
        ...inspections.flatMap((inspection) => inspection.submissions.map((submission) => submission.id)),
      ]));
      const componentIds = components.map((component) => component.id);
      const planIds = plans.map((plan) => plan.id);

      if (reportIds.length) await tx.houseReport.deleteMany({ where: { companyId: COMPANY_ID, id: { in: reportIds } } });
      if (submissionIds.length) {
        await tx.formAnswer.deleteMany({ where: { companyId: COMPANY_ID, submissionId: { in: submissionIds } } });
        await tx.formSubmission.deleteMany({ where: { companyId: COMPANY_ID, id: { in: submissionIds } } });
      }
      if (inspectionIds.length) await tx.inspection.deleteMany({ where: { companyId: COMPANY_ID, id: { in: inspectionIds } } });
      if (planIds.length || componentIds.length) {
        await tx.maintenancePlanItem.deleteMany({
          where: {
            companyId: COMPANY_ID,
            OR: [
              ...(planIds.length ? [{ planId: { in: planIds } }] : []),
              ...(componentIds.length ? [{ componentId: { in: componentIds } }] : []),
            ],
          },
        });
      }
      if (planIds.length) await tx.maintenancePlan.deleteMany({ where: { companyId: COMPANY_ID, id: { in: planIds } } });
      if (componentIds.length) {
        await tx.componentInspection.deleteMany({ where: { companyId: COMPANY_ID, componentId: { in: componentIds } } });
        await tx.component.deleteMany({ where: { companyId: COMPANY_ID, id: { in: componentIds } } });
      }
      if (propertyIds.length) {
        await tx.propertyComponent.deleteMany({ where: { companyId: COMPANY_ID, propertyId: { in: propertyIds } } });
        await tx.propertyHealthScore.deleteMany({ where: { companyId: COMPANY_ID, propertyId: { in: propertyIds } } });
        await tx.documentAsset.deleteMany({
          where: {
            companyId: COMPANY_ID,
            OR: [{ customerId: customer.id }, { propertyId: { in: propertyIds } }],
          },
        });
        await tx.customerRequest.deleteMany({
          where: {
            companyId: COMPANY_ID,
            OR: [{ customerId: customer.id }, { propertyId: { in: propertyIds } }],
          },
        });
        await tx.customerPreInspectionLink.deleteMany({
          where: {
            companyId: COMPANY_ID,
            OR: [{ customerId: customer.id }, { propertyId: { in: propertyIds } }],
          },
        });
        await tx.ownershipTransfer.deleteMany({ where: { companyId: COMPANY_ID, propertyId: { in: propertyIds } } });
        await tx.property.deleteMany({ where: { companyId: COMPANY_ID, id: { in: propertyIds } } });
      } else {
        await tx.documentAsset.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
        await tx.customerRequest.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
        await tx.customerPreInspectionLink.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
      }

      await tx.quote.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
      await tx.serviceAgreement.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
      await tx.notificationPreference.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
      await tx.notification.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
      await tx.consent.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
      await tx.gdprRequest.updateMany({ where: { companyId: COMPANY_ID, customerId: customer.id }, data: { customerId: null } });
      await tx.customerPortalAccount.deleteMany({ where: { companyId: COMPANY_ID, customerId: customer.id } });
      await tx.customer.delete({ where: { id: customer.id } });

      await tx.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          actorId: DEMO_ACTOR_ID,
          action: "DELETE_CUSTOMER",
          entity: "Customer",
          entityId: customer.id,
          before: {
            customerName: customer.name,
            propertyCount: propertyIds.length,
            reportCount: reportIds.length,
            submissionCount: submissionIds.length,
          },
        },
      });

      return { ok: true as const, deletedCustomerId: customer.id, message: "Kunden och kopplad husrapportdata raderades." };
    });

    revalidatePath("/admin/customers");
    revalidatePath("/admin/reports");
    revalidatePath("/portal");
    return result;
  } catch (error) {
    console.error("Delete customer failed", error);
    return { ok: false, message: "Kunden kunde inte raderas. Kontrollera kopplad data eller databasanslutningen." };
  }
}
