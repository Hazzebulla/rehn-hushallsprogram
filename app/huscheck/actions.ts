"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { rvmSections } from "../admin/husstatus-form/spec";

const COMPANY_ID = "org_rehn_vvs";

export type HuscheckPhoto = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
  componentId?: string;
  imageType?: "OVERVIEW" | "NAMEPLATE" | "DOCUMENTATION";
  checklistItemId?: string;
  ocrCandidate?: boolean;
};

export type HuscheckPayload = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  propertyType: string;
  buildYear: string;
  livingArea: string;
  floors: string;
  heating: string[];
  heatPumpBrand: string;
  heatPumpModel: string;
  heatPumpYear: string;
  heatPumpWorks: string;
  heatPumpAlarms: string;
  heatPumpService: string;
  heatPumpPhotos: HuscheckPhoto[];
  hotWaterType: string;
  waterHeaterBrand: string;
  waterHeaterModel: string;
  waterHeaterYear: string;
  waterHeaterSize: string;
  hotWaterProblems: string;
  waterHeaterPhotos: HuscheckPhoto[];
  heatDistribution: string;
  radiatorsWarm: string;
  coldRadiators: string;
  valvesChanged: string;
  floorHeatingType: string;
  floorHeatingAreas: string;
  floorHeatingYear: string;
  coldRooms: string;
  problems: string[];
  problemDescription: string;
  recentWork: string;
  recentWorkDescription: string;
  otherPhotos: HuscheckPhoto[];
};

export type HuscheckResult =
  | {
      ok: true;
      propertyId: string;
      submissionId: string;
      adminUrl: string;
      report: {
        green: number;
        yellow: number;
        red: number;
        points: Array<{ title: string; text: string; tone: "green" | "yellow" | "red" }>;
      };
      message: string;
    }
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

async function ensureTemplateVersion() {
  const template = await prisma.formTemplate.upsert({
    where: { id: "tpl_rvm_husstatus_24" },
    update: { name: "RVM Husstatus 25 avsnitt", audience: "FIELD_TEAM_AND_CUSTOMER" },
    create: {
      id: "tpl_rvm_husstatus_24",
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

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return clean(value).length > 0;
}

function sourceEntries(keys: string[]) {
  return Object.fromEntries(keys.map((key) => [`${key}__source`, "Kunduppgift – ej verifierad"]));
}

function yesProblem(value: string) {
  return /ja|nej|problem|larm|inte|kall|dålig|dalig|ojämn|ojamn/i.test(value);
}

function buildComponentRows(payload: HuscheckPayload) {
  const rows = [];
  const hasHeatPump = payload.heating.some((item) => /bergvärme|jordvärme|luft\/vatten|frånluft|värmepump/i.test(item));
  if (hasHeatPump || hasValue(payload.heatPumpBrand) || hasValue(payload.heatPumpModel)) {
    rows.push({
      typeName: "Värmepump",
      systemName: payload.heating.join(", ") || "Värmesystem",
      category: "Värmesystem",
      brand: clean(payload.heatPumpBrand),
      model: clean(payload.heatPumpModel),
      serialNo: "",
      installedYear: clean(payload.heatPumpYear),
      status: "Kunduppgift – ej verifierad",
      replacementYear: "",
      replacementPeriod: "",
      costKr: "",
      photos: payload.heatPumpPhotos,
    });
  }

  if (payload.hotWaterType === "Separat varmvattenberedare" || hasValue(payload.waterHeaterBrand) || hasValue(payload.waterHeaterModel)) {
    rows.push({
      typeName: "Varmvattenberedare",
      systemName: "Tappvarmvatten",
      category: "Tappvatten",
      brand: clean(payload.waterHeaterBrand),
      model: clean(payload.waterHeaterModel),
      serialNo: "",
      installedYear: clean(payload.waterHeaterYear),
      status: "Kunduppgift – ej verifierad",
      replacementYear: "",
      replacementPeriod: "",
      costKr: "",
      photos: payload.waterHeaterPhotos,
    });
  }

  return rows;
}

function mapToHusstatusAnswers(payload: HuscheckPayload) {
  const fullName = [payload.firstName, payload.lastName].map(clean).filter(Boolean).join(" ");
  const fullAddress = [payload.address, payload.postalCode, payload.city].map(clean).filter(Boolean).join(", ");
  const heating = payload.heating.join(", ");
  const componentRows = buildComponentRows(payload);
  const problemText = [
    payload.problems.length ? `Rapporterade problem: ${payload.problems.join(", ")}` : "",
    payload.problemDescription,
    payload.recentWork === "Ja" ? `Senaste VVS-arbete: ${payload.recentWorkDescription}` : "",
  ].filter(Boolean).join("\n");

  return {
    customer_name: fullName,
    contact: [payload.phone, payload.email].map(clean).filter(Boolean).join(" / "),
    property_address: fullAddress,
    build_year: clean(payload.buildYear),
    area_floors: [payload.livingArea ? `${payload.livingArea} m²` : "", payload.floors ? `${payload.floors} våningar` : ""].filter(Boolean).join(" / "),
    scope: "Kundens självdeklaration inför Husstatus",
    heat_source_type: heating,
    heat_source_product: [payload.heatPumpBrand, payload.heatPumpModel, payload.heatPumpYear].map(clean).filter(Boolean).join(" / "),
    service_history: payload.heatPumpService,
    alarms: payload.heatPumpAlarms,
    hot_water_type: payload.hotWaterType,
    hot_water_product: [payload.waterHeaterBrand, payload.waterHeaterModel, payload.waterHeaterYear, payload.waterHeaterSize].map(clean).filter(Boolean).join(" / "),
    radiator_package_notes: [payload.heatDistribution, payload.radiatorsWarm, payload.coldRadiators, payload.valvesChanged].map(clean).filter(Boolean).join(" / "),
    floor_heating: [payload.floorHeatingType, payload.floorHeatingAreas, payload.floorHeatingYear, payload.coldRooms].map(clean).filter(Boolean).join(" / "),
    observations: problemText,
    top_priority: payload.problems.includes("Läckage") || payload.problems.includes("Problem med värmepump") ? "Snar" : "Rekommendation",
    site_summary: "Kundens självdeklaration är mottagen och ska verifieras vid platsbesök.",
    create_report: "Ja",
    create_action_plan: "Ja",
    other_information: problemText,
    other_image_notes: "Bilder från kundens självdeklaration är kunduppgift och ej verifierade av montör.",
    other_information__photos: payload.otherPhotos,
    component_register_rows: componentRows,
    customer_self_declaration: {
      submittedAt: new Date().toISOString(),
      source: "Kunduppgift – ej verifierad",
      heating: payload.heating,
      problems: payload.problems,
      hotWaterType: payload.hotWaterType,
      heatDistribution: payload.heatDistribution,
      bookedControl: false,
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
      "service_history",
      "alarms",
      "hot_water_type",
      "hot_water_product",
      "radiator_package_notes",
      "floor_heating",
      "observations",
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

function buildMiniReport(payload: HuscheckPayload) {
  const points: Array<{ title: string; text: string; tone: "green" | "yellow" | "red" }> = [];
  const heatPumpYear = Number(payload.heatPumpYear);
  const waterHeaterYear = Number(payload.waterHeaterYear);

  if (Number.isFinite(heatPumpYear) && heatPumpYear > 0 && new Date().getFullYear() - heatPumpYear >= 15) {
    points.push({
      title: "Värmepump",
      text: `Installerad cirka ${heatPumpYear}. Eftersom den enligt dina uppgifter är äldre rekommenderar vi att skick och funktion kontrolleras på plats.`,
      tone: "yellow",
    });
  } else if (payload.heating.length) {
    points.push({
      title: "Uppvärmning",
      text: `Du har angett ${payload.heating.join(", ")}. Uppgiften används som underlag och verifieras vid kontrollen.`,
      tone: "green",
    });
  }

  if (payload.problems.length && !payload.problems.includes("Inga kända problem")) {
    points.push({
      title: "Rapporterade problem",
      text: `${payload.problems.join(", ")} uppges av kunden och bör verifieras på plats.`,
      tone: payload.problems.includes("Läckage") ? "red" : "yellow",
    });
  }

  if (yesProblem(payload.coldRadiators) || yesProblem(payload.coldRooms)) {
    points.push({
      title: "Värmespridning",
      text: "Du har angett ojämn värme eller kalla delar. Det kan vara värt att kontrollera flöde, ventiler eller injustering.",
      tone: "yellow",
    });
  }

  if (Number.isFinite(waterHeaterYear) && waterHeaterYear > 0 && new Date().getFullYear() - waterHeaterYear >= 15) {
    points.push({
      title: "Varmvatten",
      text: `Varmvattenberedaren uppges vara från cirka ${waterHeaterYear}. Ålder och funktion bör verifieras vid besöket.`,
      tone: "yellow",
    });
  }

  const red = points.filter((point) => point.tone === "red").length;
  const yellow = points.filter((point) => point.tone === "yellow").length;
  const green = Math.max(0, 4 - yellow - red) + points.filter((point) => point.tone === "green").length;

  return {
    green,
    yellow,
    red,
    points: points.length ? points : [{
      title: "Inga tydliga problem rapporterade",
      text: "Dina svar ger ett bra grundunderlag. Informationen ska fortfarande verifieras vid teknisk kontroll på plats.",
      tone: "green" as const,
    }],
  };
}

export async function submitHuscheckAction(payload: HuscheckPayload): Promise<HuscheckResult> {
  try {
    await ensureCompany();
    const email = clean(payload.email).toLowerCase();
    const fullName = [payload.firstName, payload.lastName].map(clean).filter(Boolean).join(" ") || "Kund Huscheck";
    const fullAddress = [payload.address, payload.postalCode, payload.city].map(clean).filter(Boolean).join(", ");

    if (!email || !fullAddress) return { ok: false, message: "Fyll i e-post och adress innan du skickar in." };

    const existingCustomer = await prisma.customer.findFirst({ where: { companyId: COMPANY_ID, invoiceEmail: email } });
    const customer = existingCustomer
      ? await prisma.customer.update({
          where: { id: existingCustomer.id },
          data: { name: fullName, phone: clean(payload.phone) || null },
        })
      : await prisma.customer.create({
          data: {
            companyId: COMPANY_ID,
            type: "PRIVATE",
            name: fullName,
            invoiceEmail: email,
            phone: clean(payload.phone) || null,
          },
        });

    const buildYear = Number(payload.buildYear);
    const property = await prisma.property.findFirst({
      where: { companyId: COMPANY_ID, customerId: customer.id, address: fullAddress },
    }) ?? await prisma.property.create({
      data: {
        companyId: COMPANY_ID,
        customerId: customer.id,
        type: payload.propertyType || "Villa",
        address: fullAddress,
        propertyNo: clean(payload.address),
        buildYear: Number.isFinite(buildYear) ? buildYear : null,
      },
    });

    const version = await ensureTemplateVersion();
    const existingDraft = await prisma.formSubmission.findFirst({
      where: {
        companyId: COMPANY_ID,
        status: "DRAFT",
        inspection: { propertyId: property.id, companyId: COMPANY_ID, type: "RVM_HUSSTATUS_SELF_DECLARATION" },
      },
      include: { inspection: true },
      orderBy: { updatedAt: "desc" },
    });

    const submission = existingDraft ?? await (async () => {
      const inspection = await prisma.inspection.create({
        data: {
          companyId: COMPANY_ID,
          propertyId: property.id,
          type: "RVM_HUSSTATUS_SELF_DECLARATION",
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
      });
    })();

    const answers = mapToHusstatusAnswers(payload);
    const entries = filledEntries(answers);
    await prisma.formAnswer.deleteMany({ where: { companyId: COMPANY_ID, submissionId: submission.id } });
    await prisma.formAnswer.createMany({
      data: entries.map(([fieldKey, value]) => ({
        companyId: COMPANY_ID,
        submissionId: submission.id,
        fieldKey,
        value: wrapAnswer(value),
      })),
    });

    await prisma.customerRequest.create({
      data: {
        companyId: COMPANY_ID,
        customerId: customer.id,
        propertyId: property.id,
        category: "Huscheck",
        priority: payload.problems.includes("Läckage") ? "HIGH" : "NORMAL",
        description: `Kundens självdeklaration mottagen. ${payload.problems.join(", ") || "Inga kända problem angivna."}`,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: null,
        action: "CUSTOMER_HUSCHECK_SUBMITTED",
        entity: "FormSubmission",
        entityId: submission.id,
        after: {
          propertyId: property.id,
          customerId: customer.id,
          source: "Kunduppgift – ej verifierad",
          fields: entries.length,
          problems: payload.problems,
        },
      },
    });

    revalidatePath("/admin/huschecks");
    revalidatePath("/admin/husstatus-form");
    revalidatePath("/admin/requests");
    revalidatePath("/husrapport");

    return {
      ok: true,
      propertyId: property.id,
      submissionId: submission.id,
      adminUrl: `/admin/husstatus-form?propertyId=${property.id}`,
      report: buildMiniReport(payload),
      message: "Tack. Din Huscheck är mottagen och ligger som underlag inför platsbesöket.",
    };
  } catch {
    return { ok: false, message: "Huschecken kunde inte skickas in just nu. Försök igen om en stund." };
  }
}
