import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { technicalSummary } from "../../../../lib/product-registry";
import { emptyInspectionState, type TechnicianInspectionState } from "../../../../lib/technician-inspection";
import { rvmSections } from "../../husstatus-form/spec";
import AdminSidebar from "../../admin-sidebar";
import TechnicianInspectionView, { type InspectionProductOption } from "./view";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ reportId: string }>;
};

function rawAnswerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as { value?: unknown; values?: unknown };
  return record.value ?? record.values;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

function customerRows(value: unknown) {
  const declaration = asRecord(value);
  const contact = asRecord(declaration.contact);
  const property = asRecord(declaration.property);
  const wetRooms = asRecord(declaration.wetRooms);
  return [
    ["Kund", text(contact.name)],
    ["E-post", text(contact.email)],
    ["Telefon", text(contact.phone)],
    ["Fastighetstyp", text(property.propertyType)],
    ["Byggår", text(property.buildYear)],
    ["Boyta", property.livingArea ? `${property.livingArea} m²` : ""],
    ["Värmekälla", text(declaration.heating)],
    ["Golvvärme / värmespridning", text(declaration.heatDistribution)],
    ["Badrum/WC", text(wetRooms.bathrooms)],
    ["Kända problem", text(wetRooms.problems)],
    ["Önskad kontroll", text(declaration.focusAreas)],
  ].filter(([, value]) => value.trim().length > 0);
}

function allCustomerRows(answers: Map<string, unknown>) {
  const rows = rvmSections.flatMap((section) =>
    section.fields.map((field) => {
      const value = text(answers.get(field.key)).trim();
      return [`${section.id}. ${field.label}`, value || "Ej besvarat"];
    }),
  );
  const filledRows = rows.filter(([, value]) => value !== "Ej besvarat");
  return filledRows.length ? rows : customerRows(answers.get("customer_self_declaration"));
}

export default async function TechnicianInspectionPage({ params }: PageProps) {
  const { reportId } = await params;
  const report = await prisma.houseReport.findFirst({
    where: { id: reportId, companyId: "org_rehn_vvs" },
    include: {
      property: { include: { customer: true } },
      submission: { include: { answers: true } },
    },
  });
  if (!report) notFound();

  const answers = new Map(report.submission.answers.map((answer) => [answer.fieldKey, rawAnswerValue(answer.value)]));
  const existingState = answers.get("technician_inspection") as TechnicianInspectionState | undefined;
  const state = existingState ?? emptyInspectionState(report.id, report.propertyId);
  const products = await prisma.productModel.findMany({
    where: { active: true },
    include: { manufacturer: true },
    orderBy: [{ category: "asc" }, { modelName: "asc" }],
    take: 800,
  });

  const productOptions: InspectionProductOption[] = products.map((product) => ({
    id: product.id,
    manufacturer: product.manufacturer.name,
    modelName: product.modelName,
    category: product.category,
    technicalInfo: technicalSummary(product),
    replacementPriceMinSek: product.replacementPriceMinSek,
    replacementPriceMaxSek: product.replacementPriceMaxSek,
    sourceText: [product.sourceUrl, product.manualUrl, product.wiringDiagramUrl].filter(Boolean).join(" "),
  }));

  return (
    <main className="adminShell">
      <AdminSidebar active="reports" label="Besiktning" />
      <TechnicianInspectionView
        initialState={state}
        productOptions={productOptions}
        report={{
          id: report.id,
          reportNo: report.reportNo,
          status: report.status,
          propertyId: report.propertyId,
          customerName: report.property.customer.name,
          address: report.property.address,
          buildYear: report.property.buildYear?.toString() ?? text(answers.get("build_year")),
          heating: text(answers.get("heat_source_type")) || "Ej angivet",
          customerCompletion: customerRows(answers.get("customer_self_declaration")).length ? 27 : 0,
          customerRows: allCustomerRows(answers),
        }}
      />
    </main>
  );
}
