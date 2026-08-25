"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../../../lib/prisma";
import {
  COMPANY_ID,
  clean,
  ensureCompany,
  ensureDraftSubmissionForProperty,
  ensurePreInspectionHouseReport,
  fullAddress,
  fullName,
  payloadFromStored,
  savePreInspectionAnswers,
  upsertPreInspectionCustomerProperty,
  type CustomerPreInspectionPayload,
} from "../../../../lib/customer-preinspection";

export type CustomerPreInspectionResult =
  | {
      ok: true;
      completed: boolean;
      message: string;
      customerName: string;
      address: string;
      propertyId: string;
      reportId?: string;
    }
  | { ok: false; message: string };

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits.length >= 7;
}

function validatePayload(payload: CustomerPreInspectionPayload) {
  const email = clean(payload.email).toLowerCase();
  const phone = clean(payload.phone);
  const address = fullAddress(payload);

  if (!validEmail(email)) return "Fyll i en giltig e-postadress.";
  if (phone && !validPhone(phone)) return "Telefonnumret verkar vara för kort.";
  if (!clean(payload.firstName) || !clean(payload.lastName)) return "Fyll i förnamn och efternamn.";
  if (!address) return "Fyll i adress, postnummer och ort.";
  if (!payload.heating.length) return "Välj hur huset värms eller välj Vet ej.";
  return "";
}

async function loadLink(token: string) {
  if (!token || token.length < 24) return null;
  return prisma.customerPreInspectionLink.findUnique({ where: { token } });
}

export async function autosaveCustomerPreInspectionAction(
  token: string,
  payload: CustomerPreInspectionPayload,
): Promise<CustomerPreInspectionResult> {
  try {
    await ensureCompany();
    const link = await loadLink(token);
    if (!link) return { ok: false, message: "Länken är ogiltig eller har tagits bort." };
    if (link.expiresAt && link.expiresAt < new Date()) return { ok: false, message: "Länken har gått ut." };

    const nextPayload = { ...payloadFromStored(link.payload), ...payload };
    await prisma.customerPreInspectionLink.update({
      where: { id: link.id },
      data: {
        payload: nextPayload,
        status: link.completedAt ? "customer_form_completed" : "customer_form_started",
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/reports");

    return {
      ok: true,
      completed: false,
      message: "Sparat. Du kan fortsätta senare med samma länk.",
      customerName: fullName(nextPayload),
      address: fullAddress(nextPayload),
      propertyId: link.propertyId ?? "",
    };
  } catch {
    return { ok: false, message: "Kunde inte autospara just nu." };
  }
}

export async function submitCustomerPreInspectionAction(
  token: string,
  payload: CustomerPreInspectionPayload,
): Promise<CustomerPreInspectionResult> {
  try {
    await ensureCompany();
    const link = await loadLink(token);
    if (!link) return { ok: false, message: "Länken är ogiltig eller har tagits bort." };
    if (link.expiresAt && link.expiresAt < new Date()) return { ok: false, message: "Länken har gått ut." };

    const validationMessage = validatePayload(payload);
    if (validationMessage) return { ok: false, message: validationMessage };

    const { customer, property } = await upsertPreInspectionCustomerProperty(payload, {
      customerId: link.customerId,
      propertyId: link.propertyId,
    });
    const submission = await ensureDraftSubmissionForProperty(property.id);
    const { fieldCount } = await savePreInspectionAnswers(submission.id, payload);

    await prisma.formSubmission.update({
      where: { id: submission.id },
      data: { status: "DRAFT" },
    });

    const report = await ensurePreInspectionHouseReport(property.id, submission.id);

    await prisma.customerPreInspectionLink.update({
      where: { id: link.id },
      data: {
        customerId: customer.id,
        propertyId: property.id,
        submissionId: submission.id,
        reportId: report.id,
        status: "customer_form_completed",
        payload,
        completedAt: new Date(),
        sourceSummary: {
          source: "customer_preinspection",
          fieldCount,
          customerName: fullName(payload),
          address: fullAddress(payload),
          duplicateHandling: "Matchar först befintlig länk, därefter e-post, därefter telefon och skapar annars ny kund.",
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: null,
        action: "CUSTOMER_PRE_INSPECTION_COMPLETED",
        entity: "HouseReport",
        entityId: report.id,
        after: {
          propertyId: property.id,
          customerId: customer.id,
          submissionId: submission.id,
          fields: fieldCount,
          status: "customer_form_completed",
        },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/reports");
    revalidatePath("/admin/new-report");
    revalidatePath("/husrapport");

    return {
      ok: true,
      completed: true,
      message: "Tack! Dina uppgifter har sparats inför din Husrapport.",
      customerName: fullName(payload),
      address: fullAddress(payload),
      propertyId: property.id,
      reportId: report.id,
    };
  } catch {
    return { ok: false, message: "Formuläret kunde inte skickas in just nu. Försök igen om en stund." };
  }
}
