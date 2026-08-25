import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { rvmSections } from "../app/admin/husstatus-form/spec";

export const COMPANY_ID = "org_rehn_vvs";
export const PRE_INSPECTION_TEMPLATE_ID = "tpl_rvm_husstatus_24";

export type CustomerPreInspectionPhoto = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
  category: string;
  imageType: "OVERVIEW" | "NAMEPLATE" | "DOCUMENTATION";
  ocrCandidate?: boolean;
};

export type CustomerPreInspectionPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  propertyType: string;
  buildYear: string;
  livingArea: string;
  floors: string;
  basement: string;
  heating: string[];
  heatingBrand: string;
  heatingModel: string;
  heatingApproxAge: string;
  heatingInstallationYear: string;
  heatingPhotos: CustomerPreInspectionPhoto[];
  hotWaterType: string;
  waterHeaterBrand: string;
  waterHeaterModel: string;
  waterHeaterVolume: string;
  waterHeaterApproxAge: string;
  waterHeaterInstallationYear: string;
  waterHeaterPhotos: CustomerPreInspectionPhoto[];
  heatDistribution: string[];
  floorHeatingScope: string;
  bathrooms: string;
  hasShower: string;
  hasBathtub: string;
  hasLaundryRoom: string;
  hasLaundryFloorDrain: string;
  wetRoomProblems: string[];
  focusAreas: string[];
  otherInformation: string;
  otherPhotos: CustomerPreInspectionPhoto[];
};

export const emptyCustomerPreInspectionPayload: CustomerPreInspectionPayload = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  postalCode: "",
  city: "",
  propertyType: "Villa",
  buildYear: "",
  livingArea: "",
  floors: "1",
  basement: "Vet ej",
  heating: [],
  heatingBrand: "",
  heatingModel: "",
  heatingApproxAge: "",
  heatingInstallationYear: "",
  heatingPhotos: [],
  hotWaterType: "",
  waterHeaterBrand: "",
  waterHeaterModel: "",
  waterHeaterVolume: "",
  waterHeaterApproxAge: "",
  waterHeaterInstallationYear: "",
  waterHeaterPhotos: [],
  heatDistribution: [],
  floorHeatingScope: "",
  bathrooms: "1",
  hasShower: "",
  hasBathtub: "",
  hasLaundryRoom: "",
  hasLaundryFloorDrain: "",
  wetRoomProblems: [],
  focusAreas: [],
  otherInformation: "",
  otherPhotos: [],
};

export type CustomerPreInspectionLinkVm = {
  token: string;
  urlPath: string;
  status: string;
  completedAt: string | null;
  customerName: string;
  address: string;
  payload: CustomerPreInspectionPayload;
};

export function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown) {
  const number = Number(clean(value).replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function fullName(payload: CustomerPreInspectionPayload) {
  return [payload.firstName, payload.lastName].map(clean).filter(Boolean).join(" ");
}

export function fullAddress(payload: CustomerPreInspectionPayload) {
  return [payload.address, payload.postalCode, payload.city].map(clean).filter(Boolean).join(", ");
}

export function generatePublicToken() {
  return randomBytes(24).toString("base64url");
}

export async function ensureCompany() {
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

export async function ensureTemplateVersion() {
  const template = await prisma.formTemplate.upsert({
    where: { id: PRE_INSPECTION_TEMPLATE_ID },
    update: { name: "RVM Husstatus 25 avsnitt", audience: "FIELD_TEAM_AND_CUSTOMER" },
    create: {
      id: PRE_INSPECTION_TEMPLATE_ID,
      companyId: COMPANY_ID,
      name: "RVM Husstatus 25 avsnitt",
      audience: "FIELD_TEAM_AND_CUSTOMER",
    },
  });

  return prisma.formVersion.upsert({
    where: { templateId_version: { templateId: template.id, version: 1 } },
    update: { schema: { sections: rvmSections }, publishedAt: new Date() },
    create: {
      companyId: COMPANY_ID,
      templateId: template.id,
      version: 1,
      schema: { sections: rvmSections },
      publishedAt: new Date(),
    },
  });
}

export async function ensurePublicPreInspectionLink(propertyId?: string | null) {
  await ensureCompany();
  const existing = propertyId
    ? await prisma.customerPreInspectionLink.findFirst({
        where: { companyId: COMPANY_ID, propertyId, completedAt: null },
        orderBy: { createdAt: "desc" },
      })
    : null;
  if (existing) return existing;

  const property = propertyId
    ? await prisma.property.findFirst({ where: { companyId: COMPANY_ID, id: propertyId }, include: { customer: true } })
    : null;

  return prisma.customerPreInspectionLink.create({
    data: {
      companyId: COMPANY_ID,
      token: generatePublicToken(),
      customerId: property?.customerId ?? null,
      propertyId: property?.id ?? null,
      status: "customer_form_started",
      sourceSummary: property ? {
        createdFor: "existing_property",
        customerName: property.customer.name,
        address: property.address,
      } : {
        createdFor: "new_customer",
      },
    },
  });
}

export function sourceEntries(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [`${key}__source`, "Uppgift från kund - ej verifierad"]));
}

function componentRows(payload: CustomerPreInspectionPayload) {
  const rows = [];
  const heatPumpSelected = payload.heating.some((item) => /bergvärme|luft\/vatten|luft\/luft|värmepump/i.test(item));
  if (heatPumpSelected || payload.heatingBrand || payload.heatingModel) {
    rows.push({
      typeName: "Värmepump / panna",
      systemName: payload.heating.join(", ") || "Värmesystem",
      category: "Värmesystem",
      brand: clean(payload.heatingBrand),
      model: clean(payload.heatingModel),
      serialNo: "",
      installedYear: clean(payload.heatingInstallationYear),
      status: "Kunduppgift - ej verifierad",
      replacementYear: "",
      replacementPeriod: "",
      costKr: "",
      photos: payload.heatingPhotos,
    });
  }

  if (payload.hotWaterType === "Separat varmvattenberedare" || payload.waterHeaterBrand || payload.waterHeaterModel) {
    rows.push({
      typeName: "Varmvattenberedare",
      systemName: "Tappvarmvatten",
      category: "Tappvatten",
      brand: clean(payload.waterHeaterBrand),
      model: clean(payload.waterHeaterModel),
      serialNo: "",
      installedYear: clean(payload.waterHeaterInstallationYear),
      status: "Kunduppgift - ej verifierad",
      replacementYear: "",
      replacementPeriod: "",
      costKr: "",
      photos: payload.waterHeaterPhotos,
    });
  }

  return rows;
}

export function mapPreInspectionToHusstatusAnswers(payload: CustomerPreInspectionPayload) {
  const name = fullName(payload);
  const address = fullAddress(payload);
  const heatSource = payload.heating.join(", ");
  const heatProduct = [payload.heatingBrand, payload.heatingModel, payload.heatingInstallationYear || payload.heatingApproxAge]
    .map(clean)
    .filter(Boolean)
    .join(" / ");
  const hotWaterProduct = [
    payload.waterHeaterBrand,
    payload.waterHeaterModel,
    payload.waterHeaterVolume,
    payload.waterHeaterInstallationYear || payload.waterHeaterApproxAge,
  ].map(clean).filter(Boolean).join(" / ");
  const problemText = [
    payload.focusAreas.length ? `Kunden vill kontrollera: ${payload.focusAreas.join(", ")}` : "",
    payload.wetRoomProblems.length ? `Kända problem: ${payload.wetRoomProblems.join(", ")}` : "",
    payload.otherInformation,
  ].filter(Boolean).join("\n");

  return {
    customer_name: name,
    contact: [payload.phone, payload.email].map(clean).filter(Boolean).join(" / "),
    property_address: address,
    build_year: clean(payload.buildYear),
    area_floors: [
      payload.livingArea ? `${payload.livingArea} m²` : "",
      payload.floors ? `${payload.floors} våningar` : "",
      payload.basement ? `Källare: ${payload.basement}` : "",
    ].filter(Boolean).join(" / "),
    scope: "Kundens förformulär inför RVM Husrapport",
    heat_source_type: heatSource,
    heat_source_product: heatProduct,
    hot_water_type: payload.hotWaterType,
    hot_water_product: hotWaterProduct,
    radiator_package_notes: payload.heatDistribution.join(", "),
    floor_heating: payload.heatDistribution.includes("Golvvärme") ? payload.floorHeatingScope : "Ej angivet av kund",
    observations: problemText,
    known_issues: problemText,
    site_summary: "Kundens förformulär är mottaget. Uppgifterna ska verifieras av montör på plats.",
    other_information: problemText,
    other_image_notes: "Bilder från kundens förformulär är kunduppgift och ej verifierade av montör.",
    other_information__photos: payload.otherPhotos,
    component_register_rows: componentRows(payload),
    customer_self_declaration: {
      source: "customer_preinspection",
      submittedAt: new Date().toISOString(),
      status: "customer_form_completed",
      contact: {
        name,
        email: payload.email,
        phone: payload.phone,
      },
      property: {
        address,
        propertyType: payload.propertyType,
        buildYear: payload.buildYear,
        livingArea: payload.livingArea,
        floors: payload.floors,
        basement: payload.basement,
      },
      heating: payload.heating,
      hotWaterType: payload.hotWaterType,
      heatDistribution: payload.heatDistribution,
      wetRooms: {
        bathrooms: payload.bathrooms,
        hasShower: payload.hasShower,
        hasBathtub: payload.hasBathtub,
        hasLaundryRoom: payload.hasLaundryRoom,
        hasLaundryFloorDrain: payload.hasLaundryFloorDrain,
        problems: payload.wetRoomProblems,
      },
      focusAreas: payload.focusAreas,
      estimatedCompletion: 25,
      verified: false,
    },
    ...sourceEntries([
      "customer_name",
      "contact",
      "property_address",
      "build_year",
      "area_floors",
      "scope",
      "heat_source_type",
      "heat_source_product",
      "hot_water_type",
      "hot_water_product",
      "radiator_package_notes",
      "floor_heating",
      "observations",
      "known_issues",
      "site_summary",
      "other_information",
      "other_image_notes",
    ]),
  };
}

function filledEntries(answers: Record<string, unknown>) {
  return Object.entries(answers).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return clean(value).length > 0;
  });
}

function wrapAnswer(value: unknown): Prisma.InputJsonValue {
  return (Array.isArray(value) ? { values: value } : { value }) as Prisma.InputJsonValue;
}

export async function ensureDraftSubmissionForProperty(propertyId: string) {
  const existing = await prisma.formSubmission.findFirst({
    where: {
      companyId: COMPANY_ID,
      status: "DRAFT",
      inspection: { companyId: COMPANY_ID, propertyId },
    },
    include: { inspection: true },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  const version = await ensureTemplateVersion();
  const inspection = await prisma.inspection.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      type: "RVM_HUSSTATUS_PRE_INSPECTION",
      status: "DRAFT",
    },
  });

  return prisma.formSubmission.create({
    data: {
      companyId: COMPANY_ID,
      versionId: version.id,
      inspectionId: inspection.id,
      status: "DRAFT",
    },
    include: { inspection: true },
  });
}

async function nextReportNo() {
  const year = new Date().getFullYear();
  const count = await prisma.houseReport.count({
    where: { companyId: COMPANY_ID, reportNo: { startsWith: `RVM-HS-${year}-` } },
  });
  return `RVM-HS-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function upsertPreInspectionCustomerProperty(payload: CustomerPreInspectionPayload, link: { customerId: string | null; propertyId: string | null }) {
  const email = clean(payload.email).toLowerCase();
  const phone = clean(payload.phone);
  const name = fullName(payload) || "Kund Husrapport";
  const address = fullAddress(payload);
  const buildYear = numberOrNull(payload.buildYear);

  let customer = link.customerId
    ? await prisma.customer.findFirst({ where: { companyId: COMPANY_ID, id: link.customerId } })
    : null;

  if (!customer && email) {
    customer = await prisma.customer.findFirst({ where: { companyId: COMPANY_ID, invoiceEmail: email } });
  }
  if (!customer && phone) {
    customer = await prisma.customer.findFirst({ where: { companyId: COMPANY_ID, phone } });
  }

  customer = customer
    ? await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name,
          invoiceEmail: email || customer.invoiceEmail,
          phone: phone || customer.phone,
        },
      })
    : await prisma.customer.create({
        data: {
          companyId: COMPANY_ID,
          type: "PRIVATE",
          name,
          invoiceEmail: email,
          phone: phone || null,
        },
      });

  let property = link.propertyId
    ? await prisma.property.findFirst({ where: { companyId: COMPANY_ID, id: link.propertyId } })
    : null;

  if (!property && address) {
    property = await prisma.property.findFirst({ where: { companyId: COMPANY_ID, customerId: customer.id, address } });
  }

  property = property
    ? await prisma.property.update({
        where: { id: property.id },
        data: {
          customerId: customer.id,
          type: payload.propertyType || property.type,
          address: address || property.address,
          propertyNo: clean(payload.address) || property.propertyNo,
          buildYear: buildYear ?? property.buildYear,
        },
      })
    : await prisma.property.create({
        data: {
          companyId: COMPANY_ID,
          customerId: customer.id,
          type: payload.propertyType || "Villa",
          address,
          propertyNo: clean(payload.address) || address,
          buildYear,
        },
      });

  return { customer, property };
}

export async function savePreInspectionAnswers(submissionId: string, payload: CustomerPreInspectionPayload) {
  const answers = mapPreInspectionToHusstatusAnswers(payload);
  const entries = filledEntries(answers);

  await prisma.formAnswer.deleteMany({ where: { companyId: COMPANY_ID, submissionId } });
  await prisma.formAnswer.createMany({
    data: entries.map(([fieldKey, value]) => ({
      companyId: COMPANY_ID,
      submissionId,
      fieldKey,
      value: wrapAnswer(value),
    })),
  });

  return { answers, fieldCount: entries.length };
}

export async function ensurePreInspectionHouseReport(propertyId: string, submissionId: string) {
  const existing = await prisma.houseReport.findFirst({
    where: {
      companyId: COMPANY_ID,
      propertyId,
      submissionId,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    return prisma.houseReport.update({
      where: { id: existing.id },
      data: { status: "customer_form_completed" },
    });
  }

  const submission = await prisma.formSubmission.findUnique({ where: { id: submissionId }, include: { version: true } });
  return prisma.houseReport.create({
    data: {
      companyId: COMPANY_ID,
      propertyId,
      submissionId,
      reportNo: await nextReportNo(),
      status: "customer_form_completed",
      formVersion: submission?.version.version ?? 1,
      reportVersion: 1,
      summary: {
        source: "customer_preinspection",
        estimatedCompletion: 25,
      },
    },
  });
}

export function payloadFromStored(value: unknown): CustomerPreInspectionPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyCustomerPreInspectionPayload;
  return { ...emptyCustomerPreInspectionPayload, ...(value as Partial<CustomerPreInspectionPayload>) };
}
