import { prisma } from "../../lib/prisma";
import { getLiveOutdoorTemperature } from "../../lib/weather";
import { houseReportStatusLabel } from "../../lib/house-report-status";
import { rvmFieldCount, rvmSections } from "../admin/husstatus-form/spec";
import { updateHouseReportStatusAction } from "./actions";
import PrintReportButton from "./print-button";

type BarDatum = {
  label: string;
  value: number;
};

type CostBar = {
  label: string;
  detail: string;
  percent: number;
};

type JournalDoc = {
  title: string;
  rows: string[];
};

type ReportSignature = {
  id: string;
  label: string;
  signedBy: string;
  role: string;
  signedAt: string;
  imageDataUrl: string;
  valid: boolean;
};

type SystemStatus = {
  label: string;
  score: number;
  status: string;
};

type WeatherVm = {
  value: string;
  source: string;
};

const statusCards = [
  ["Totalt riskindex", "28%", "Låg risk", "cyan"],
  ["Energipotential", "18%", "Besparingsmöjlighet", "cyan"],
  ["Teknisk status", "78%", "God", "green"],
  ["Prioriterade åtgärder", "5", "Aktuella", "gold"],
];

const profile = [
  ["Byggår", "1978"],
  ["Boyta / biyta", "154 / 62 m²"],
  ["Plan", "1½ plan + källare"],
  ["Värmekälla", "Bergvärme"],
  ["Antal badrum", "2"],
  ["Radiatorer", "10 st"],
  ["Vatten / avlopp", "Kommunalt"],
  ["Energibrunn", "140 m, ca 125 m aktivt"],
];

const heatRegister = [
  ["Värmepump", "NIBE F1245-8", "8 kW / 180 l", "NIBE-1245-1608742", "2016", "God"],
  ["Cirk.pump värme", "Grundfos Alpha2 25-60", "DN25 / 180 mm", "GF-A2-44881", "2016", "Bra"],
  ["Köldbärarpump", "Grundfos UPM3 25-75", "DN25 / 180 mm", "GF-UPM3-88721", "2016", "Bra"],
  ["Expansionskärl", "Reflex N 18", "18 l / DN20", "RX-N18-2010-445", "2010", "Bör bytas"],
  ["Blandningsventil", "ESBE VTA322", "DN20", "ESBE-322-8954", "2015", "Bra"],
  ["Smutsfilter", "IMI Zeparo Cyclone", "DN25", "IMI-ZC-2022-311", "2022", "Bra"],
];

const waterItems = [
  ["Diskbänksskåp", "Otät botten", "Dold vattenskada", "Täta insats och städad genomföring", "2 500-4 500 kr"],
  ["Diskmaskin", "Underlägg saknas", "Läckage upptäcks sent", "Underlägg och sensor", "1 500-3 000 kr"],
  ["Vattenlarm", "Saknas", "Fördröjd upptäckt", "Minst 2 sensorer", "1 500-3 500 kr"],
  ["Vattenfelsbrytare", "Saknas", "Stort skadeförlopp", "Godkänt system med prov", "12 000-20 000 kr"],
  ["Badrum 1", "Tätskikt ca 2001", "Åldersrelaterad fuktrisk", "Fördjupad kontroll/renovering", "180 000-260 000 kr"],
];

const drift = [
  ["Utetemp", "+12,0 °C"],
  ["Innetemp", "21,2 °C"],
  ["Framledning", "34,8 °C"],
  ["Retur", "31,9 °C"],
  ["Brine in", "+2,7 °C"],
  ["Brine ut", "-0,2 °C"],
  ["VV nära", "51,8 °C"],
  ["VV längst bort", "47,2 °C"],
];

const plan = [
  ["2026", "Byt expansionskärl", "Hög", "4 500-7 500 kr"],
  ["2028", "Vattensäkra kök", "Hög", "16 000-27 000 kr"],
  ["2031", "Radiatorventiler 10 st", "Medel", "10 000-13 000 kr"],
  ["2034", "Filma/spola avlopp", "Medel", "6 000-12 000 kr"],
  ["2040", "Service/byte värmepump", "Hög", "135 000-190 000 kr"],
  ["2046", "Renovera badrum", "Hög", "160 000-260 000 kr"],
];

const packages = [
  ["Säkerhetspaket", "Expansionskärl + säkerhetskontroll", "9 900 kr"],
  ["Effektivitetspaket", "Cirkulationspump + driftoptimering", "16 900 kr"],
  ["Komfortpaket", "10 radiatorventiler + injustering", "19 900 kr"],
  ["Premiumpaket", "Vattensäkring + värmeoptimering", "39 900 kr"],
];

type ReportData = {
  propertyId?: string;
  reportId?: string;
  reportNo: string;
  reportStatus: string;
  formStatus: string;
  formProgress: number;
  formVersion?: number;
  reportVersion?: number;
  performedAt?: string;
  performedBy?: string;
  reportOwner?: string;
  nextControl?: string;
  quarterlyControl?: string;
  deliveryMethod?: string;
  liveWeather?: WeatherVm;
  customerInformation: string[][];
  customerImages: number;
  hasCompletedForm: boolean;
  dataSufficient: boolean;
  leadText: string;
  statusCards: string[][];
  healthScoreLabel: string;
  healthStatusText: string;
  riskIndexLabel: string;
  systemStatuses: SystemStatus[];
  profile: string[][];
  heatRegister: string[][];
  drift: string[][];
  energyTrend: BarDatum[];
  technicalAssessment: string[];
  waterCards: string[][];
  waterItems: string[][];
  waterPackage?: string[];
  plan: string[][];
  investmentTotal: string;
  costBars: CostBar[];
  priorityRows: string[][];
  packageCards: string[][];
  journalDocs: JournalDoc[];
  signatures: ReportSignature[];
  topRisks: string[][];
  recommendedActions: string[];
  riskOverview: Array<[string, number]>;
};

type ReportPropertyOption = {
  id: string;
  label: string;
  detail: string;
};

type ReportComponent = {
  status: string;
  riskLevel: string;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  estimatedYear: number | null;
  plannedReplacementYear: number | null;
  replacementCostCents: number;
  replacementLabel?: string;
  displayStatus?: string;
  type: { name: string; category: string; normalLifeYears: number };
  system: { name: string; category: string } | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function rawAnswerValue(value: unknown) {
  const record = asRecord(value);
  return record.value ?? record.values;
}

function answerValue(value: unknown) {
  const record = asRecord(value);
  const raw = record.value ?? record.values;
  return Array.isArray(raw) ? raw.join(", ") : raw === undefined || raw === null ? "" : String(raw);
}

function statusLabel(score: number) {
  if (score >= 80) return "Bra";
  if (score >= 60) return "Bör följas upp";
  if (score >= 40) return "Åtgärder rekommenderas";
  return "Förhöjd risk";
}

function priorityFromStatus(status: string, riskLevel: string) {
  if (status === "RED" && riskLevel === "HIGH") return "Akut";
  if (status === "RED" || riskLevel === "HIGH") return "Hög";
  if (status === "ORANGE" || status === "YELLOW" || riskLevel === "MEDIUM") return "Medel";
  if (status === "GREEN" || riskLevel === "LOW") return "Låg";
  return "Underhåll";
}

function costLabel(costCents: number) {
  if (!costCents) return "Pris ej fastställt";
  return `${Math.round(costCents / 100).toLocaleString("sv-SE")} kr`;
}

function krLabel(costCents: number) {
  return `${Math.round(costCents / 100).toLocaleString("sv-SE")} kr`;
}

function krRangeLabel(lowCents: number, highCents: number) {
  if (!lowCents && !highCents) return "Pris ej fastställt";
  if (lowCents === highCents) return krLabel(lowCents);
  return `${krLabel(lowCents)}–${krLabel(highCents).replace(" kr", "")} kr`;
}

function numberAnswer(answers: Map<string, string>, key: string) {
  const raw = String(answers.get(key) ?? "").trim();
  if (!raw) return undefined;
  const value = Number(raw.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function textAnswer(answers: Map<string, string>, key: string) {
  return String(answers.get(key) ?? "").trim();
}

function hasAnyAnswer(answers: Map<string, string>, keys: string[]) {
  return keys.some((key) => textAnswer(answers, key).length > 0);
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean).join(", ") : String(value ?? "");
}

function customerDeclarationRows(value: unknown) {
  const declaration = asRecord(value);
  const contact = asRecord(declaration.contact);
  const property = asRecord(declaration.property);
  const wetRooms = asRecord(declaration.wetRooms);
  const rows = [
    ["Namn", stringList(contact.name)],
    ["E-post", stringList(contact.email)],
    ["Telefon", stringList(contact.phone)],
    ["Fastighet", stringList(property.address)],
    ["Fastighetstyp", stringList(property.propertyType)],
    ["Byggår", stringList(property.buildYear)],
    ["Boyta", property.livingArea ? `${property.livingArea} m²` : ""],
    ["Våningar", stringList(property.floors)],
    ["Källare", stringList(property.basement)],
    ["Värmekälla", stringList(declaration.heating)],
    ["Varmvatten", stringList(declaration.hotWaterType)],
    ["Värmedistribution", stringList(declaration.heatDistribution)],
    ["Badrum/WC", stringList(wetRooms.bathrooms)],
    ["Tvättstuga", stringList(wetRooms.hasLaundryRoom)],
    ["Kända problem", stringList(wetRooms.problems)],
    ["Önskad kontroll", stringList(declaration.focusAreas)],
  ].filter(([, detail]) => detail.trim().length > 0);

  return { rows, imageCount: 0 };
}

type SectionStatusMap = Record<string, "active" | "not_applicable">;

const reportFieldSectionByKey = new Map(
  rvmSections.flatMap((section) => section.fields.map((field) => [field.key, section.id] as const)),
);

function sectionStatusMap(rawAnswers: Map<string, unknown>): SectionStatusMap {
  const value = rawAnswers.get("section_statuses");
  return value && typeof value === "object" && !Array.isArray(value) ? value as SectionStatusMap : {};
}

function isReportSectionActive(statuses: SectionStatusMap, sectionId: number) {
  return statuses[String(sectionId)] !== "not_applicable";
}

function answerKeyIsActive(statuses: SectionStatusMap, key: string) {
  if (key === "section_statuses" || key === "image_checklist_statuses") return false;
  const baseKey = key.replace(/__source$|__photos$/, "");
  const sectionId = reportFieldSectionByKey.get(baseKey);
  return sectionId ? isReportSectionActive(statuses, sectionId) : true;
}

function notApplicableSectionLabels(statuses: SectionStatusMap) {
  return rvmSections
    .filter((section) => !isReportSectionActive(statuses, section.id))
    .map((section) => `${section.id}. ${section.title}`);
}

function lightweightReportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(lightweightReportValue);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === "string" || typeof record.imageDataUrl === "string") {
    return { ...record, dataUrl: "", imageDataUrl: "" };
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, lightweightReportValue(item)]));
}

function stableReportStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableReportStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value ?? "");
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableReportStringify(item)}`)
    .join(",")}}`;
}

function simpleReportHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function reportSignatureHashFromRaw(rawAnswers: Map<string, unknown>, statuses: SectionStatusMap) {
  const significant = Object.fromEntries(
    Array.from(rawAnswers.entries())
      .filter(([key]) =>
        key === "section_statuses"
        || (key !== "signatures" && key !== "image_checklist_statuses" && answerKeyIsActive(statuses, key)),
      )
      .map(([key, value]) => [key, lightweightReportValue(value)]),
  );
  return simpleReportHash(stableReportStringify(significant));
}

function reportSignatures(rawAnswers: Map<string, unknown>, currentHash: string): ReportSignature[] {
  const value = rawAnswers.get("signatures");
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, Record<string, unknown>>)
    .map(([id, item]) => ({
      id,
      label: String(item.label ?? id),
      signedBy: String(item.signedBy ?? ""),
      role: String(item.role ?? ""),
      signedAt: String(item.signedAt ?? ""),
      imageDataUrl: String(item.imageDataUrl ?? ""),
      valid: String(item.signedHash ?? "") === currentHash,
    }))
    .filter((signature) => signature.imageDataUrl && signature.signedBy);
}

function displayText(value: string | undefined | null, fallback = "Ej kontrollerad") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function measurementLabel(value: number | undefined, unit: string) {
  return value === undefined ? "Ej uppmätt" : `${String(value).replace(".", ",")} ${unit}`;
}

function formatMeasurement(value: number | undefined, unit: string) {
  return value === undefined ? "Ej uppmätt" : `${value.toFixed(1).replace(".", ",")} ${unit}`;
}

function generateSummary(args: {
  health: number;
  systemStatuses: SystemStatus[];
  topRisks: string[][];
  recommendedActions: string[];
  dataSufficient: boolean;
}) {
  if (!args.dataSufficient) {
    return "Underlaget är ännu inte tillräckligt för en säker kundbedömning. Komplettera formulär, mätvärden och komponentstatus innan rapporten används som beslutsunderlag.";
  }

  const weakSystems = args.systemStatuses
    .filter((system) => system.score < 70)
    .map((system) => system.label.toLowerCase());
  const systemsText = weakSystems.length
    ? `förbättringspunkter inom ${weakSystems.slice(0, 3).join(", ")}`
    : "inga tydliga systemområden med förhöjd risk i registrerat underlag";
  const actions = args.recommendedActions.slice(0, 3).map((item) => item.toLowerCase());
  const actionText = actions.length ? ` De viktigaste nästa stegen är ${actions.join(", ")}.` : "";

  return `Fastigheten har Husstatus ${args.health}/100 (${statusLabel(args.health)}) och ${systemsText}.${actionText}`;
}

const reportAnswerFieldKeys = new Set(rvmSections.flatMap((section) => section.fields.map((field) => field.key)));

function riskWord(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/akut|hog|lackage|vattenskada|saknas|avvikelse|brist|otat/.test(normalized)) return "Hög";
  if (/medel|rekommenderas|ej kontrollerat|periodvis|okant/.test(normalized)) return "Medel";
  if (/ok|bra|god|finns|nej|kontrollerat/.test(normalized)) return "Låg";
  return "Bedöms";
}

function waterEstimate(label: string, observation: string) {
  const risk = riskWord(observation);
  const normalized = `${label} ${observation}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  if (/badrum|tattskikt|renover/.test(normalized) && risk === "Hög") return "Fördjupad offert";
  if (/avlopp|filma|spola/.test(normalized)) return risk === "Hög" ? "6 000-12 000 kr" : "3 500-7 500 kr";
  if (/golvbrunn/.test(normalized)) return risk === "Hög" ? "8 000-18 000 kr" : "2 500-6 500 kr";
  if (/diskmaskin|larm|sensor|underlagg/.test(normalized)) return risk === "Hög" ? "2 500-5 500 kr" : "1 500-3 500 kr";
  if (/diskbank|skap|genomfor/.test(normalized)) return risk === "Hög" ? "3 500-8 500 kr" : "1 500-4 500 kr";
  if (/tvatt/.test(normalized)) return risk === "Hög" ? "3 500-8 500 kr" : "1 500-4 500 kr";
  return risk === "Låg" ? "Ingår i kontroll" : "2 500-6 500 kr";
}

function estimateMiddleCents(label: string) {
  const numbers = label.match(/\d[\d\s]*/g)?.map((value) => Number(value.replace(/\s/g, ""))).filter(Number.isFinite) ?? [];
  if (!numbers.length) return 0;
  const average = numbers.length >= 2 ? Math.round((numbers[0] + numbers[1]) / 2) : numbers[0];
  return average * 100;
}

function riskPercent(status: string, riskLevel: string) {
  if (status === "RED" || riskLevel === "HIGH") return 82;
  if (status === "ORANGE") return 64;
  if (status === "YELLOW" || riskLevel === "MEDIUM") return 46;
  if (status === "GREEN" || riskLevel === "LOW") return 18;
  return 28;
}

function componentStatusFromText(value: string): { status: string; riskLevel: string } {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/rod|hog|akut|snar|bor bytas|ska bytas/.test(normalized)) return { status: "RED", riskLevel: "HIGH" };
  if (/orange|plan/.test(normalized)) return { status: "ORANGE", riskLevel: "MEDIUM" };
  if (/gul|medel|normal|avvikelse|rekommenderas/.test(normalized)) return { status: "YELLOW", riskLevel: "MEDIUM" };
  if (/gron|god|bra|ok/.test(normalized)) return { status: "GREEN", riskLevel: "LOW" };
  return { status: "GREY", riskLevel: "LOW" };
}

function formComponentsFromAnswers(rawAnswers: Map<string, unknown>): ReportComponent[] {
  const rawRows = rawAnswers.get("component_register_rows");
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .map((rawRow) => asRecord(rawRow))
    .filter((row) => String(row.typeName ?? "").trim().length > 0)
    .slice(0, 20)
    .map((row) => {
      const typeName = String(row.typeName ?? "").trim();
      const category = String(row.category ?? "Värmesystem").trim() || "Värmesystem";
      const systemName = String(row.systemName ?? category).trim() || category;
      const displayStatus = String(row.status ?? "").trim() || "Ej bedömd";
      const { status, riskLevel } = componentStatusFromText(displayStatus);
      const estimatedYear = Number(String(row.installedYear ?? "").replace(/[^\d]/g, ""));
      const replacementYear = Number(String(row.replacementYear ?? "").replace(/[^\d]/g, ""));
      const replacementPeriod = String(row.replacementPeriod ?? "").trim();
      const costKr = Number(String(row.costKr ?? "").replace(/[^\d]/g, ""));
      const normalLifeYears = status === "RED" ? 1 : 20;
      const plannedReplacementYear = Number.isFinite(replacementYear) && replacementYear > 0
        ? replacementYear
        : Number.isFinite(estimatedYear) && estimatedYear > 0 ? estimatedYear + normalLifeYears : null;

      return {
        status,
        riskLevel,
        brand: String(row.brand ?? "").trim() || null,
        model: String(row.model ?? "").trim() || null,
        serialNo: String(row.serialNo ?? "").trim() || null,
        estimatedYear: Number.isFinite(estimatedYear) && estimatedYear > 0 ? estimatedYear : null,
        plannedReplacementYear,
        replacementCostCents: Number.isFinite(costKr) ? costKr * 100 : 0,
        replacementLabel: plannedReplacementYear ? `${plannedReplacementYear}${replacementPeriod ? ` ${replacementPeriod}` : ""}` : undefined,
        displayStatus,
        type: { name: typeName, category, normalLifeYears },
        system: { name: systemName, category },
      };
    });
}

function riskFromAnswerMap(answers: Map<string, string>) {
  if (!answers.size) return undefined;
  let risk = 18;

  for (const text of answers.values()) {
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/akut|hog|bor bytas|lackage|vattenskada|tryckfall/.test(normalized)) risk += 9;
    if (/avvikelse|saknas|rekommenderas|brist|fuktrisk|otat|underlagg saknas/.test(normalized)) risk += 6;
    if (/medel|planerad|periodvis|ej kontrollerat|okant/.test(normalized)) risk += 3;
    if (/god|bra|ok|finns|kontrollerat|nej/.test(normalized)) risk -= 2;
  }

  return Math.max(8, Math.min(92, Math.round(risk)));
}

async function getReportProperties(): Promise<ReportPropertyOption[]> {
  try {
    const properties = await prisma.property.findMany({
      where: { companyId: "org_rehn_vvs" },
      include: { customer: true },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });

    return properties.map((property) => ({
      id: property.id,
      label: property.propertyNo ?? property.address,
      detail: `${property.customer.name} - ${property.address}`,
    }));
  } catch {
    return [];
  }
}

async function getReportData(propertyId?: string, selectedReportId?: string): Promise<ReportData> {
  try {
    const blockedReportData = (message: string): ReportData => ({
      propertyId: undefined,
      reportId: selectedReportId,
      reportNo: "Rapport saknas",
      reportStatus: "NOT_FOUND",
      formStatus: "NOT_STARTED",
      formProgress: 0,
      customerInformation: [],
      customerImages: 0,
      hasCompletedForm: false,
      dataSufficient: false,
      leadText: message,
      statusCards: [
        ["Rapportstatus", "Saknas", "Kontrollera länken", "gold"],
        ["Riskindex", "Ej beräknat", "Underlag saknas", "gold"],
        ["Teknisk status", "Ej bedömd", "Systemet gissar inte", "gold"],
        ["Publicering", "Stängd", "Kund ser inget ännu", "gold"],
      ],
      healthScoreLabel: "Ej bedömd",
      healthStatusText: "Underlag saknas",
      riskIndexLabel: "Ej beräknat",
      systemStatuses: [],
      profile: [],
      heatRegister: [],
      drift: [],
      energyTrend: [],
      technicalAssessment: [],
      waterCards: [],
      waterItems: [],
      waterPackage: undefined,
      plan: [],
      investmentTotal: "",
      costBars: [],
      priorityRows: [],
      packageCards: [],
      journalDocs: [],
      signatures: [],
      topRisks: [],
      recommendedActions: ["Öppna rapporten från rapportlistan igen."],
      riskOverview: [],
    });
    const selectedReport = selectedReportId
      ? await prisma.houseReport.findFirst({
          where: { id: selectedReportId, companyId: "org_rehn_vvs" },
          select: { id: true, propertyId: true, submissionId: true },
        })
      : null;
    if (selectedReportId && !selectedReport) {
      return blockedReportData("Rapportdata kunde inte laddas. Ingen annan kunddata visas.");
    }
    const property = await prisma.property.findFirst({
      where: selectedReport
        ? { id: selectedReport.propertyId, companyId: "org_rehn_vvs" }
        : propertyId ? { id: propertyId, companyId: "org_rehn_vvs" } : { companyId: "org_rehn_vvs" },
      orderBy: { updatedAt: "desc" },
      include: {
        customer: true,
        healthScore: true,
        components: {
          include: { type: true, system: true },
          orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
          take: 60,
        },
        inspections: {
          orderBy: { performedAt: "desc" },
          take: 1,
          include: {
            submissions: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { answers: true },
            },
          },
        },
        houseReports: {
          where: selectedReport ? { id: selectedReport.id } : undefined,
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
    }) as Awaited<ReturnType<typeof prisma.property.findFirst>> & {
      customer?: { name: string; phone: string | null; invoiceEmail: string | null };
      healthScore?: { score: number; explanation: unknown } | null;
      components?: Array<{
        status: string;
        riskLevel: string;
        brand: string | null;
        model: string | null;
        serialNo: string | null;
        estimatedYear: number | null;
        plannedReplacementYear: number | null;
        replacementCostCents: number;
        type: { name: string; category: string; normalLifeYears: number };
        system: { name: string; category: string } | null;
      }>;
      inspections?: Array<{
        status: string;
        performedAt: Date | null;
        submissions: Array<{
          id: string;
          status: string;
          signedAt: Date | null;
          updatedAt: Date;
          answers: Array<{ fieldKey: string; value: unknown }>;
        }>;
      }>;
      houseReports?: Array<{
        id: string;
        reportNo: string;
        status: string;
        formVersion: number;
        reportVersion: number;
        generatedAt: Date;
        performedAt: Date | null;
        performedBy: string | null;
        reportOwner: string | null;
        nextControl: string | null;
        summary: unknown;
      }>;
    } | null;

    if (!property) {
      return {
        propertyId: undefined,
        reportNo: "Ej skapad",
        reportStatus: "NOT_STARTED",
        formStatus: "NOT_STARTED",
        formProgress: 0,
        customerInformation: [],
        customerImages: 0,
        hasCompletedForm: false,
        dataSufficient: false,
        leadText: "Ingen färdig RVM Husstatusrapport finns ännu. Välj fastighet och slutför formuläret för att skapa rapport.",
        statusCards: [
          ["Rapportstatus", "Ej klar", "0 % formulär", "cyan"],
          ["Riskindex", "Ej beräknat", "Underlag saknas", "gold"],
          ["Teknisk status", "Ej bedömd", "Systemet gissar inte", "gold"],
          ["Publicering", "Stängd", "Kund ser inget ännu", "gold"],
        ],
        healthScoreLabel: "Ej bedömd",
        healthStatusText: "Underlag saknas",
        riskIndexLabel: "Ej beräknat",
        systemStatuses: [],
        profile: [],
        heatRegister: [],
        drift: [],
        energyTrend: [],
        technicalAssessment: [],
        waterCards: [],
        waterItems: [],
        waterPackage: undefined,
        plan: [],
        investmentTotal: "",
        costBars: [],
        priorityRows: [],
        packageCards: [],
        journalDocs: [],
        signatures: [],
        topRisks: [],
        recommendedActions: ["Slutför RVM Husstatus-formuläret för fastigheten."],
        riskOverview: [],
      };
    }
    const propertyCustomer = property.customer;
    if (!propertyCustomer) {
      return blockedReportData("Fastigheten saknar kopplad kund. Ingen annan kunddata visas.");
    }

    const reportSubmission = selectedReport
      ? await prisma.formSubmission.findFirst({
          where: {
            id: selectedReport.submissionId,
            companyId: "org_rehn_vvs",
            inspection: { propertyId: property.id, companyId: "org_rehn_vvs" },
          },
          include: { answers: true, inspection: true },
        })
      : null;
    if (selectedReport && !reportSubmission) {
      return blockedReportData("Rapporten saknar giltigt formulärunderlag för den här fastigheten. Ingen annan kunddata visas.");
    }
    const draftSubmission = selectedReport ? null : await prisma.formSubmission.findFirst({
      where: {
        companyId: "org_rehn_vvs",
        status: "DRAFT",
        inspection: { propertyId: property.id, companyId: "org_rehn_vvs" },
      },
      include: { answers: true, inspection: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    const completedSubmission = selectedReport ? null : await prisma.formSubmission.findFirst({
      where: {
        companyId: "org_rehn_vvs",
        status: { not: "DRAFT" },
        inspection: { propertyId: property.id, companyId: "org_rehn_vvs" },
      },
      include: { answers: true, inspection: true },
      orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
    });
    const directSubmission = reportSubmission ?? draftSubmission ?? completedSubmission;
    const latestSubmission = directSubmission ?? property.inspections?.[0]?.submissions[0];
    const latestReport = property.houseReports?.[0];
    const liveOutdoor = await getLiveOutdoorTemperature(`${property.address}, ${property.propertyNo ?? ""}`);
    const liveWeather = liveOutdoor
      ? {
          value: `${liveOutdoor.temperature.toFixed(1).replace(".", ",")} ${liveOutdoor.unit}`,
          source: `${liveOutdoor.provider} live, ${liveOutdoor.place}${liveOutdoor.measuredAt ? ` ${liveOutdoor.measuredAt.replace("T", " ")}` : ""}`,
        }
      : undefined;
    const latestRawAnswersAll = new Map<string, unknown>(
      latestSubmission?.answers.map((answer) => [answer.fieldKey, rawAnswerValue(answer.value)]) ?? [],
    );
    if (selectedReport) {
      latestRawAnswersAll.set("customer_name", propertyCustomer.name);
      latestRawAnswersAll.set("contact", [propertyCustomer.phone, propertyCustomer.invoiceEmail].filter(Boolean).join(" / "));
      latestRawAnswersAll.set("property_address", [property.propertyNo, property.address].filter(Boolean).join(" / "));
      latestRawAnswersAll.set("build_year", property.buildYear?.toString() ?? "");
    }
    const customerDeclaration = customerDeclarationRows(latestRawAnswersAll.get("customer_self_declaration"));
    if (selectedReport) {
      const identityLabels = new Set(["Namn", "E-post", "Telefon", "Fastighet", "Byggår"]);
      customerDeclaration.rows = [
        ["Namn", propertyCustomer.name],
        ["E-post", propertyCustomer.invoiceEmail ?? ""],
        ["Telefon", propertyCustomer.phone ?? ""],
        ["Fastighet", [property.propertyNo, property.address].filter(Boolean).join(" / ")],
        ["Byggår", property.buildYear?.toString() ?? ""],
        ...customerDeclaration.rows.filter(([label]) => !identityLabels.has(label)),
      ].filter(([, detail]) => detail.trim().length > 0);
    }
    const sectionStatuses = sectionStatusMap(latestRawAnswersAll);
    const currentSignatureHash = reportSignatureHashFromRaw(latestRawAnswersAll, sectionStatuses);
    const signatures = reportSignatures(latestRawAnswersAll, currentSignatureHash);
    const inactiveSections = notApplicableSectionLabels(sectionStatuses);
    const latestRawAnswers = new Map(
      Array.from(latestRawAnswersAll.entries()).filter(([key]) => answerKeyIsActive(sectionStatuses, key)),
    );
    const latestAnswersAll = new Map<string, string>(
      latestSubmission?.answers.map((answer) => [answer.fieldKey, answerValue(answer.value)]) ?? [],
    );
    if (selectedReport) {
      latestAnswersAll.set("customer_name", propertyCustomer.name);
      latestAnswersAll.set("contact", [propertyCustomer.phone, propertyCustomer.invoiceEmail].filter(Boolean).join(" / "));
      latestAnswersAll.set("property_address", [property.propertyNo, property.address].filter(Boolean).join(" / "));
      latestAnswersAll.set("build_year", property.buildYear?.toString() ?? "");
    }
    const latestAnswers = new Map(
      Array.from(latestAnswersAll.entries()).filter(([key]) => answerKeyIsActive(sectionStatuses, key)),
    );
    const activeReportFieldCount = rvmSections
      .filter((section) => isReportSectionActive(sectionStatuses, section.id))
      .reduce((sum, section) => sum + section.fields.length, 0);
    const answeredFields = Array.from(latestAnswers.entries()).filter(([key, value]) => {
      if (key.endsWith("__source") || key.endsWith("__photos")) return false;
      return reportAnswerFieldKeys.has(key) && value.trim().length > 0;
    }).length;
    const formProgress = Math.min(100, Math.round((answeredFields / Math.max(activeReportFieldCount, 1)) * 100));
    const hasCompletedForm = latestSubmission?.status === "SUBMITTED" || latestSubmission?.status === "COMPLETED";
    const dataSufficient = answeredFields >= Math.max(8, Math.round(activeReportFieldCount * 0.12));
    const explanation = asRecord(property.healthScore?.explanation);
    const answerRisk = dataSufficient ? riskFromAnswerMap(latestAnswers) : undefined;
    const risk = dataSufficient ? Number(answerRisk ?? explanation.risk ?? 28) : 0;
    const health = dataSufficient ? (answerRisk ? Math.max(18, Math.min(94, 100 - answerRisk)) : property.healthScore?.score ?? 74) : 0;
    const nextAction = String(explanation.nextAction ?? latestAnswers.get("site_summary") ?? "Rapporten behöver granskas");
    const heating = String(explanation.heating ?? latestAnswers.get("heat_source_type") ?? latestAnswers.get("hot_water_type") ?? "Uppgift saknas");

    const formComponents = formComponentsFromAnswers(latestRawAnswers);
    const storedComponents: ReportComponent[] = property.components ?? [];
    const components = formComponents.length ? formComponents : storedComponents;
    const highPriority = components.filter((component) => component.status === "RED" || component.riskLevel === "HIGH").length;
    const componentRows = components.length
      ? components.slice(0, 10).map((component) => [
          component.type.name,
          `${component.brand ?? ""} ${component.model ?? ""}`.trim() || "Uppgift saknas",
          component.system?.name ?? component.type.category,
          component.serialNo ?? "Uppgift saknas",
          component.estimatedYear?.toString() ?? "Uppgift saknas",
          component.displayStatus ?? (component.status === "RED" ? "Bör bytas" : component.status === "GREEN" ? "Bra" : component.status),
        ])
      : heatRegister;

    const currentYear = new Date().getFullYear();
    const plannedComponents = components
      .filter((component) => component.plannedReplacementYear)
      .sort((a, b) => (a.plannedReplacementYear ?? 9999) - (b.plannedReplacementYear ?? 9999))
      .slice(0, 8);
    const planRows = plannedComponents.map((component) => [
      component.replacementLabel ?? String(Math.max(component.plannedReplacementYear ?? currentYear, currentYear)),
      `Åtgärda ${component.type.name}`,
      priorityFromStatus(component.status, component.riskLevel),
      costLabel(component.replacementCostCents),
    ]);

    const riskByCategory = new Map<string, number[]>();
    for (const component of components) {
      const key = component.type.category || component.system?.category || "Övrigt";
      const current = riskByCategory.get(key) ?? [];
      current.push(riskPercent(component.status, component.riskLevel));
      riskByCategory.set(key, current);
    }
    const riskOverview: Array<[string, number]> = riskByCategory.size
      ? Array.from(riskByCategory.entries()).map(([label, values]) => [
          label,
          Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        ] as [string, number])
      : [];
    const topRisks: string[][] = components.length
      ? components
          .slice()
          .sort((a, b) => riskPercent(b.status, b.riskLevel) - riskPercent(a.status, a.riskLevel))
          .slice(0, 4)
          .map((component) => [component.type.name, priorityFromStatus(component.status, component.riskLevel)])
      : [["Nästa åtgärd", risk >= 50 ? "Hög" : "Medel"]];

    const annualControlEnabled = /^ja$/i.test(textAnswer(latestAnswers, "annual_control"));
    const quarterlyControl = textAnswer(latestAnswers, "quarterly_control");
    const deliveryMethod = textAnswer(latestAnswers, "quarterly_delivery");
    const quarterlyControlEnabled = /^(ja|erbjuds)$/i.test(quarterlyControl);
    const recommendedActions = [
      ...(topRisks.length
        ? topRisks.map(([name, prio]) => `${prio === "Akut" || prio === "Hög" ? "Åtgärda" : "Följ upp"} ${name}`)
        : [nextAction]),
      ...(annualControlEnabled ? ["Lägg in årlig kontroll av värme, tryck, filter och säkerhetsfunktion"] : []),
      ...(quarterlyControlEnabled ? [`Skicka kvartalsvis kontrollöversyn${deliveryMethod ? ` via ${deliveryMethod.toLowerCase()}` : ""}`] : []),
    ];

    const rawDriftRows: Array<[string, string | number | undefined, string] | undefined> = [
      ["Utetemp live", liveWeather?.value ?? "Ej uppmätt", ""],
      ["Utetemp kontroll", measurementLabel(numberAnswer(latestAnswers, "outdoor_temp_c"), "°C"), ""],
      ["Innetemp", textAnswer(latestAnswers, "residents_temp") || "Ej uppmätt", ""],
      ["Framledning", measurementLabel(numberAnswer(latestAnswers, "supply_temp_c"), "°C"), ""],
      ["Retur", measurementLabel(numberAnswer(latestAnswers, "return_temp_c"), "°C"), ""],
      ["Brine in", measurementLabel(numberAnswer(latestAnswers, "brine_in_c"), "°C"), ""],
      ["Brine ut", measurementLabel(numberAnswer(latestAnswers, "brine_out_c"), "°C"), ""],
      ["VV nära", measurementLabel(numberAnswer(latestAnswers, "nearest_tap_c"), "°C"), ""],
      ["VV längst bort", measurementLabel(numberAnswer(latestAnswers, "furthest_tap_c"), "°C"), ""],
    ];
    const driftRows = rawDriftRows
      .filter((row): row is [string, string | number | undefined, string] => Boolean(row))
      .map(([label, value, unit]) => [String(label), `${value}${unit ? ` ${unit}` : ""}`]);

    const supply = numberAnswer(latestAnswers, "supply_temp_c");
    const ret = numberAnswer(latestAnswers, "return_temp_c");
    const brineIn = numberAnswer(latestAnswers, "brine_in_c");
    const brineOut = numberAnswer(latestAnswers, "brine_out_c");
    const vvNear = numberAnswer(latestAnswers, "nearest_tap_c");
    const vvFar = numberAnswer(latestAnswers, "furthest_tap_c");
    const electricity = numberAnswer(latestAnswers, "electricity_kwh");
    const waterUse = numberAnswer(latestAnswers, "water_m3");
    const energyTrend: BarDatum[] = [
      electricity !== undefined ? { label: "El kWh", value: Math.max(4, Math.min(100, electricity / 260)) } : undefined,
      waterUse !== undefined ? { label: "Vatten", value: Math.max(4, Math.min(100, waterUse / 2.5)) } : undefined,
    ].filter(Boolean) as BarDatum[];

    const technicalAssessment = [
      `Temperaturdifferens värme: ${supply !== undefined && ret !== undefined ? formatMeasurement(Math.abs(supply - ret), "°C") : "Ej uppmätt"}.`,
      `Köldbärardifferens: ${brineIn !== undefined && brineOut !== undefined ? formatMeasurement(Math.abs(brineIn - brineOut), "°C") : "Ej uppmätt"}.`,
      `Varmvattenfall nära/längst bort: ${vvNear !== undefined && vvFar !== undefined ? formatMeasurement(Math.abs(vvNear - vvFar), "°C") : "Ej uppmätt"}.`,
      energyTrend.length ? "Energioptimeringspotential: Bedömd från registrerad energi-/vattendata." : "Energioptimeringspotential: Ej bedömd.",
      textAnswer(latestAnswers, "energy_notes"),
      textAnswer(latestAnswers, "service_notes"),
    ].filter(Boolean);

    const waterChecks = [
      ["Diskbänksskåp", "kitchen_sink_cabinet", "kitchen_waterproof_base", "Täta/genomför och dokumentera under diskbänk"],
      ["Diskmaskin", "dishwasher", "water_alarm", "Underlägg, avstängning och läckagesensor"],
      ["Badrum/WC", "bathroom_1_wc", "bathroom_1_leak", "Fördjupad våtrumskontroll vid avvikelse"],
      ["Golvbrunn", "bathroom_1_drain", "floor_drain", "Kontrollera ålder, fabrikat och tätskiktsanslutning"],
      ["Tvättstuga", "laundry_machines", "laundry_alarm", "Kontroll av maskiner, brunn och larm"],
      ["Avlopp", "known_stops", "sewer_film", "Filma/spola vid stopp, lukt eller okänd status"],
    ];
    const waterCards = waterChecks
      .map(([label, first, second]) => {
        const value = [textAnswer(latestAnswers, first), textAnswer(latestAnswers, second)].filter(Boolean).join(" / ");
        return value ? [label, riskWord(value)] : undefined;
      })
      .filter(Boolean) as string[][];
    const waterItems = waterChecks
      .map(([label, first, second, recommendation]) => {
        const observation = [textAnswer(latestAnswers, first), textAnswer(latestAnswers, second)].filter(Boolean).join(" / ");
        if (!observation) return undefined;
        return [label, observation, riskWord(observation), recommendation, waterEstimate(label, observation)];
      })
      .filter(Boolean) as string[][];
    const waterSystemScore = waterCards.length
      ? Math.max(20, 100 - Math.round(waterCards.reduce((sum, [, riskName]) => sum + (riskName === "Hög" ? 68 : riskName === "Medel" ? 42 : 18), 0) / waterCards.length))
      : undefined;
    const systemStatuses: SystemStatus[] = [
      ...riskOverview.map(([label, riskValue]) => {
        const score = Math.max(0, Math.min(100, 100 - riskValue));
        return { label, score, status: statusLabel(score) };
      }),
      ...(waterSystemScore !== undefined ? [{ label: "Vattensäkerhet", score: waterSystemScore, status: statusLabel(waterSystemScore) }] : []),
    ];
    const waterCost = waterItems.reduce((sum, item) => sum + estimateMiddleCents(item[4]), 0);
    const waterPackage = waterItems.length && waterCost
      ? ["RVM Vattensäkring - rekommenderat startpaket", krRangeLabel(Math.round(waterCost * 0.7), Math.round(waterCost * 1.15))]
      : undefined;
    const planTotal = plannedComponents.reduce((sum, component) => sum + component.replacementCostCents, 0);
    const investmentTotal = planTotal ? `ca ${krRangeLabel(planTotal, Math.round(planTotal * 1.25))}` : "";
    const costBars = [
      { label: "0-5 år", detail: "Akuta och närliggande åtgärder", from: 0, to: 5 },
      { label: "6-10 år", detail: "Planerade byten och service", from: 6, to: 10 },
      { label: "11-20 år", detail: "Långsiktig underhållsplan", from: 11, to: 20 },
    ].map((period) => {
      const periodCost = components
        .filter((component) => {
          const replacementYear = Math.max(component.plannedReplacementYear ?? currentYear + 99, currentYear);
          const years = replacementYear - currentYear;
          return years >= period.from && years <= period.to;
        })
        .reduce((sum, component) => sum + component.replacementCostCents, 0);
      return {
        label: period.label,
        detail: periodCost ? `${period.detail} - ${krLabel(periodCost)}` : period.detail,
        percent: planTotal ? Math.max(4, Math.round((periodCost / planTotal) * 100)) : 0,
      };
    }).filter((bar) => bar.percent > 0);
    const priorityRows = [
      ...planRows.slice(0, 5).map(([year, action, prio, cost], index) => [
      String(index + 1),
      action,
      prio === "Hög" ? "Minskar risk för skada" : "Planerad förbättring",
      year,
      cost,
      prio === "Hög" ? "Rek." : "Plan",
      ]),
      ...(annualControlEnabled
        ? [[
            String(Math.min(planRows.length + 1, 6)),
            "Årlig kontroll av värme och VVS",
            "Förebygger driftstopp och fångar upp läckage, tryckfall och filterproblem",
            "Årligen",
            "Enligt serviceavtal",
            "Service",
          ]]
        : []),
    ].slice(0, 6);
    const safetyTotal = waterCost;
    const heatTotal = components
      .filter((component) => /värme|varme|pump|radiator|kärl|karl/i.test(`${component.type.name} ${component.type.category} ${component.system?.name ?? ""}`))
      .reduce((sum, component) => sum + component.replacementCostCents, 0);
    const packageCards = [
      safetyTotal ? ["Säkerhetspaket", "Prioriterad vattensäkring enligt kontrollpunkter", krRangeLabel(Math.round(safetyTotal * 0.7), Math.round(safetyTotal * 1.15))] : undefined,
      heatTotal ? ["Värmepaket", "Värmesystem, tryckhållning och radiatorer", krLabel(heatTotal)] : undefined,
      planTotal ? ["20-årsplan", "Samlad preliminär investering", krRangeLabel(planTotal, Math.round(planTotal * 1.25))] : undefined,
    ].filter(Boolean) as string[][];
    const journalDocs: JournalDoc[] = [
      planRows[0]
        ? { title: `Utföranderapport - ${planRows[0][1]}`, rows: [`Planår ${planRows[0][0]}`, `Prioritet ${planRows[0][2]}`, `Estimat ${planRows[0][3]}`] }
        : undefined,
      technicalAssessment.length
        ? { title: "Egenkontroll", rows: technicalAssessment.slice(0, 4) }
        : undefined,
      inactiveSections.length
        ? { title: "Finns ej i fastigheten", rows: inactiveSections.slice(0, 10) }
        : undefined,
      hasAnyAnswer(latestAnswers, ["service_advice", "rvm_service_agreement", "annual_control", "quarterly_control", "quarterly_delivery", "next_control", "followup_owner"])
        ? { title: "Husjournal", rows: [textAnswer(latestAnswers, "service_advice"), annualControlEnabled ? "Årlig kontroll ska göras" : "", quarterlyControlEnabled ? `Kvartalsvis kontrollöversyn${deliveryMethod ? ` via ${deliveryMethod.toLowerCase()}` : ""}` : "", textAnswer(latestAnswers, "rvm_service_agreement"), textAnswer(latestAnswers, "next_control"), textAnswer(latestAnswers, "followup_owner")].filter(Boolean) }
        : undefined,
    ].filter(Boolean) as JournalDoc[];

    return {
      propertyId: property.id,
      reportId: latestReport?.id,
      reportNo: latestReport?.reportNo ?? "Ej skapad",
      reportStatus: latestReport?.status ?? (hasCompletedForm ? "READY_FOR_REVIEW" : answeredFields > 0 ? "DRAFT" : "NOT_STARTED"),
      formStatus: latestSubmission?.status ?? "NOT_STARTED",
      formProgress,
      formVersion: latestReport?.formVersion,
      reportVersion: latestReport?.reportVersion,
      performedAt: latestReport?.performedAt?.toLocaleDateString("sv-SE") ?? directSubmission?.inspection?.performedAt?.toLocaleDateString("sv-SE") ?? property.inspections?.[0]?.performedAt?.toLocaleDateString("sv-SE"),
      performedBy: latestReport?.performedBy ?? undefined,
      reportOwner: latestReport?.reportOwner ?? undefined,
      nextControl: latestReport?.nextControl ?? (textAnswer(latestAnswers, "next_control") || undefined),
      quarterlyControl: quarterlyControl || undefined,
      deliveryMethod: deliveryMethod || undefined,
      liveWeather,
      customerInformation: customerDeclaration.rows,
      customerImages: customerDeclaration.imageCount,
      hasCompletedForm,
      dataSufficient,
      leadText: String(latestAnswers.get("site_summary") || explanation.summary || generateSummary({
        health,
        systemStatuses,
        topRisks,
        recommendedActions,
        dataSufficient,
      })),
      statusCards: dataSufficient
        ? [
            ["Riskindex", `${risk}%`, risk >= 60 ? "Hög risk" : risk >= 35 ? "Medel risk" : "Låg risk", "gold"],
            ["Energipotential", latestAnswers.get("energy_notes") || latestAnswers.get("electricity_kwh") ? "Bedömd" : "Ej kontrollerat", "Från formulär", "cyan"],
            ["Prioriterade åtgärder", String(Math.max(highPriority, recommendedActions.length)), "Aktuella", "gold"],
          ]
        : [
            ["Rapportstatus", hasCompletedForm ? "Granskas" : "Arbetsläge", `${formProgress} % formulär`, "cyan"],
            ["Underlag", `${answeredFields}`, "ifyllda fält", "cyan"],
            ["Riskindex", "Ej beräknat", "Underlag saknas", "gold"],
            ["Teknisk status", "Ej bedömd", "Systemet gissar inte", "gold"],
          ],
      healthScoreLabel: dataSufficient ? `${health}/100` : "Ej bedömd",
      healthStatusText: dataSufficient ? statusLabel(health) : "Underlag saknas",
      riskIndexLabel: dataSufficient ? `${risk}%` : "Ej beräknat",
      systemStatuses,
      profile: [
        ["Kund", displayText(property.customer?.name, "Ej kontrollerad")],
        ["Fastighet", displayText(property.propertyNo, "Ej kontrollerad")],
        ["Adress", property.address],
        ["Byggår", property.buildYear?.toString() ?? displayText(latestAnswers.get("build_year"), "Ej kontrollerad")],
        ["Värmekälla", heating],
        ["Omfattning", displayText(latestAnswers.get("scope"), "Ej kontrollerad")],
        ["Grundläggning", displayText(latestAnswers.get("foundation"), "Ej kontrollerad")],
        ["Vatten / avlopp", displayText(latestAnswers.get("water_source"), "Ej kontrollerad")],
      ],
      heatRegister: componentRows,
      drift: driftRows,
      energyTrend,
      technicalAssessment,
      waterCards,
      waterItems,
      waterPackage,
      plan: planRows,
      investmentTotal,
      costBars,
      priorityRows,
      packageCards,
      journalDocs,
      signatures,
      topRisks,
      recommendedActions,
      riskOverview,
    };
  } catch {
    return {
      propertyId: undefined,
      reportNo: "Ej skapad",
      reportStatus: "OFFLINE",
      formStatus: "UNKNOWN",
      formProgress: 0,
      customerInformation: [],
      customerImages: 0,
      hasCompletedForm: false,
      dataSufficient: false,
      leadText: "Rapportdata kunde inte laddas från databasen.",
      statusCards: [
        ["Rapportstatus", "Offline", "Databasen svarar inte", "gold"],
        ["Riskindex", "Ej beräknat", "Underlag saknas", "gold"],
        ["Teknisk status", "Ej bedömd", "Systemet gissar inte", "gold"],
        ["Publicering", "Stängd", "Kund ser inget ännu", "gold"],
      ],
      healthScoreLabel: "Ej bedömd",
      healthStatusText: "Underlag saknas",
      riskIndexLabel: "Ej beräknat",
      systemStatuses: [],
      profile: [],
      heatRegister: [],
      drift: [],
      energyTrend: [],
      technicalAssessment: [],
      waterCards: [],
      waterItems: [],
      waterPackage: undefined,
      plan: [],
      investmentTotal: "",
      costBars: [],
      priorityRows: [],
      packageCards: [],
      journalDocs: [],
      signatures: [],
      topRisks: [],
      recommendedActions: ["Kontrollera databasanslutningen och försök igen."],
      riskOverview: [],
    };
  }
}

function RvmLogo() {
  return (
    <div className="rvmLogo" aria-label="RVM Husstatus">
      <div className="miniMark" />
      <div>
        <strong>RVM</strong>
        <span>Husstatus</span>
      </div>
    </div>
  );
}

function SectionHeader({ no, title }: { no: string; title: string }) {
  return (
    <header className="reportSectionHeader">
      <span>RVM Husstatus Premium Rapport</span>
      <h2>{no}. {title}</h2>
    </header>
  );
}

function reportStatusLabel(status: string) {
  if (/^(customer_form_started|customer_form_completed|visit_scheduled|inspection_in_progress|review_required|published|archived)$/.test(status)) {
    return houseReportStatusLabel(status);
  }
  if (status === "DRAFT") return "Utkast";
  if (status === "READY_FOR_REVIEW") return "Klar för granskning";
  if (status === "APPROVED") return "Godkänd av RVM";
  if (status === "PUBLISHED") return "Publicerad till kund";
  if (status === "ARCHIVED") return "Arkiverad";
  if (status === "NOT_STARTED") return "Inte påbörjad";
  if (status === "OFFLINE") return "Offline";
  return status;
}

function formStatusLabel(status: string) {
  if (status === "DRAFT") return "Bygger på utkast";
  if (status === "SUBMITTED" || status === "COMPLETED") return "Bygger på slutfört formulär";
  if (status === "NOT_STARTED") return "Formulär ej påbörjat";
  return status;
}

export const dynamic = "force-dynamic";

export default async function HusrapportPage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string; reportId?: string }>;
}) {
  const params = await searchParams;
  const [reportData, reportProperties] = await Promise.all([
    getReportData(params?.propertyId, params?.reportId),
    getReportProperties(),
  ]);
  const {
    propertyId,
    reportId,
    reportNo,
    reportStatus,
    formStatus,
    formProgress,
    formVersion,
    reportVersion,
    performedAt,
    performedBy,
    reportOwner,
    nextControl,
    quarterlyControl,
    deliveryMethod,
    liveWeather,
    customerInformation,
    customerImages,
    hasCompletedForm,
    dataSufficient,
    leadText,
    statusCards,
    healthScoreLabel,
    healthStatusText,
    riskIndexLabel,
    systemStatuses,
    profile,
    heatRegister,
    drift,
    energyTrend,
    technicalAssessment,
    waterCards,
    waterItems,
    waterPackage,
    plan,
    investmentTotal,
    costBars,
    priorityRows,
    packageCards,
    journalDocs,
    signatures,
    topRisks,
    recommendedActions,
    riskOverview,
  } = reportData;
  const reportHref = reportId ? `/husrapport?reportId=${reportId}` : propertyId ? `/husrapport?propertyId=${propertyId}` : "/husrapport";
  const formHref = reportId ? `/admin/husstatus-form?reportId=${reportId}` : propertyId ? `/admin/husstatus-form?propertyId=${propertyId}` : "/admin/husstatus-form";
  const dataExportHref = propertyId ? `/api/husrapport/export?propertyId=${propertyId}` : "/api/husrapport/export";
  const formDataPdfHref = propertyId ? `/api/husrapport/form-data-pdf?propertyId=${propertyId}` : "/api/husrapport/form-data-pdf";

  return (
    <main className="statusReport">
      <nav className="modeNav inline noPrint" aria-label="Demo navigation">
        <a href="/">Omslag</a>
        <a className="active" href={reportHref}>Status Husrapport</a>
        <a href="/portal">Kundkonto</a>
        <a href="/admin">RVM arbetsyta</a>
      </nav>

      <section className="statusTop">
        <RvmLogo />
        <div className="reportMeta">
          <span>Rapportnummer</span>
          <strong>{reportNo}</strong>
          <small>{formStatusLabel(formStatus)}</small>
        </div>
      </section>

      <section className="reportWorkflow noPrint">
        <div>
          <span>Rapportflöde</span>
          <strong>Kund → fastighet → kontrollbesök → formulär → rapport → granskning → publicering</strong>
        </div>
        <div className="reportWorkflowActions">
          <a className="buttonLink" href={formHref}>
            {formStatus === "NOT_STARTED" ? "Fyll i formulär" : formStatus === "DRAFT" ? `Fortsätt formulär - ${formProgress} % klart` : "Visa formulärunderlag"}
          </a>
          <a className="buttonLink" href={reportHref}>Förhandsgranska rapport</a>
          <span className="statusPill">{reportStatusLabel(reportStatus)}</span>
          {reportId && reportStatus === "READY_FOR_REVIEW" && (
            <form action={updateHouseReportStatusAction}>
              <input name="reportId" type="hidden" value={reportId} />
              <input name="status" type="hidden" value="APPROVED" />
              <button>Godkänn av RVM</button>
            </form>
          )}
          {reportId && reportStatus === "APPROVED" && (
            <form action={updateHouseReportStatusAction}>
              <input name="reportId" type="hidden" value={reportId} />
              <input name="status" type="hidden" value="PUBLISHED" />
              <button>Publicera till kund</button>
            </form>
          )}
          <PrintReportButton dataHref={dataExportHref} formDataPdfHref={formDataPdfHref} disabled={!dataSufficient} />
        </div>
      </section>

      <section className="reportQualityBar">
        <div><span>Formulärversion</span><strong>{formVersion ?? "Ej låst"}</strong></div>
        <div><span>Rapportversion</span><strong>{reportVersion ?? "Ej skapad"}</strong></div>
        <div><span>Kontrolldatum</span><strong>{performedAt ?? "Ej kontrollerat"}</strong></div>
        <div><span>Utförd av</span><strong>{performedBy ?? "Ej angivet"}</strong></div>
        <div><span>Rapportansvarig</span><strong>{reportOwner ?? "Ej angivet"}</strong></div>
        <div><span>Nästa kontroll</span><strong>{nextControl ?? "Ej angivet"}</strong></div>
        <div><span>Kvartalsöversyn</span><strong>{quarterlyControl ?? "Ej valt"}</strong></div>
        <div><span>Leverans</span><strong>{deliveryMethod ?? "Ej valt"}</strong></div>
      </section>

      {customerInformation.length > 0 && (
        <section className="customerDeclarationPanel noPrint">
          <div className="panelTitle">
            <h3>Information från kunden</h3>
            <span>Kundformulär: Klart · Rapportens uppskattade färdigställande: 25 %</span>
          </div>
          <dl>
            {customerInformation.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p>Alla uppgifter är markerade som kunduppgift och ska verifieras av montör på plats. Kundbilder ligger i formulärunderlaget{customerImages ? ` (${customerImages} st)` : ""}.</p>
        </section>
      )}

      {!hasCompletedForm && dataSufficient && (
        <section className="reportGate noPrint">
          <strong>Arbetsläge - ej publicerad kundrapport.</strong>
          <p>Status, risk och åtgärder beräknas från det autosparade formuläret. Slutför och granska formuläret innan rapporten används som kundversion.</p>
          <a className="buttonLink" href={formHref}>Fortsätt formulär</a>
        </section>
      )}

      {!hasCompletedForm && !dataSufficient && (
        <section className="reportGate noPrint">
          <strong>Mer underlag behövs.</strong>
          <p>Fyll i fler centrala formulärfält för den valda fastigheten. Rapporten börjar bedöma risk och teknisk status när minst 12 riktiga formulärfält är ifyllda.</p>
          <a className="buttonLink" href={formHref}>Fyll i formulär</a>
        </section>
      )}

      {hasCompletedForm && !dataSufficient && (
        <section className="reportGate noPrint">
          <strong>Underlaget är inte tillräckligt för en tillförlitlig statusbedömning.</strong>
          <p>Komplettera formuläret eller markera saknade uppgifter som Ej kontrollerat, Ej åtkomligt eller Ej aktuellt innan risk och teknisk status används.</p>
        </section>
      )}

      {reportProperties.length > 0 && (
        <section className="reportPropertySwitch noPrint" aria-label="Välj fastighet för husrapport">
          <span>Testa rapport per fastighet</span>
          <div>
            {reportProperties.map((property) => (
              <a
                className={property.id === propertyId ? "active" : ""}
                href={`/husrapport?propertyId=${property.id}`}
                key={property.id}
              >
                <strong>{property.label}</strong>
                <small>{property.detail}</small>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="customerPrintSheet" aria-label="Kundblad">
        <header>
          <RvmLogo />
          <div>
            <span>RVM Husstatus Kundöversikt</span>
            <strong>{reportNo}</strong>
            <small>{performedAt ?? "Datum saknas"}</small>
          </div>
        </header>
        <div className="customerHero">
          <div>
            <h1>{profile.find(([term]) => term === "Fastighet")?.[1] ?? "Fastighet"}</h1>
            <p>{leadText}</p>
          </div>
          <div className="customerStats">
            <article>
              <span>Husstatus</span>
              <strong>{healthScoreLabel}</strong>
              <small>{healthStatusText}</small>
            </article>
            {statusCards.slice(0, 4).map(([label, value, sub]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{sub}</small>
              </article>
            ))}
          </div>
        </div>
        <div className="customerGrid">
          <article>
            <h2>System</h2>
            <dl>
              {profile.slice(0, 8).map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
            </dl>
          </article>
          <article>
            <h2>Risker och nästa steg</h2>
            <ol>
              {recommendedActions.slice(0, 5).map((action) => <li key={action}>{action}</li>)}
            </ol>
          </article>
        </div>
        <div className="customerTables">
          <article>
            <h2>Värmesystem</h2>
            <table>
              <thead><tr><th>Komponent</th><th>Modell</th><th>År</th><th>Status</th></tr></thead>
              <tbody>
                {heatRegister.slice(0, 8).map(([component, model, , , year, status]) => (
                  <tr key={`${component}-${model}`}><td>{component}</td><td>{model}</td><td>{year}</td><td>{status}</td></tr>
                ))}
              </tbody>
            </table>
          </article>
          <article>
            <h2>Plan</h2>
            <table>
              <thead><tr><th>Tid</th><th>Åtgärd</th><th>Prio</th><th>Estimat</th></tr></thead>
              <tbody>
                {plan.slice(0, 6).map(([time, action, prio, cost]) => (
                  <tr key={`${time}-${action}`}><td>{time}</td><td>{action}</td><td>{prio}</td><td>{cost}</td></tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
        <footer>
          <span>Nästa kontroll: {nextControl ?? "Ej angivet"}</span>
          <span>Kvartalsöversyn: {quarterlyControl ?? "Ej valt"}{deliveryMethod ? `, ${deliveryMethod}` : ""}</span>
          <span>Rapportansvarig: {reportOwner ?? "Ej angivet"}</span>
        </footer>
      </section>

      <section className="reportPage">
        <SectionHeader no="1" title="Sammanfattning" />
        <div className="summaryHero">
          <article className="houseStatusPanel">
            <span>Husstatus</span>
            <strong>{healthScoreLabel}</strong>
            <b>{healthStatusText}</b>
            <small>Riskindex: {riskIndexLabel}</small>
          </article>
          <p className="leadText">{leadText}</p>
        </div>
        {systemStatuses.length > 0 ? (
          <div className="systemStatusGrid">
            {systemStatuses.map((system) => (
              <article key={system.label}>
                <span>{system.label}</span>
                <strong>{system.score}/100</strong>
                <small>{system.status}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyReportState">Delstatus visas när komponenter eller kontrollpunkter finns registrerade.</div>
        )}
        <div className="statusMetricGrid secondary">
          {statusCards.map(([label, value, sub, tone]) => (
            <article className="statusMetric compact" key={label}>
              <div className={`thinRing ${tone}`} />
              <strong>{value}</strong>
              <span>{label}</span>
              <small>{sub}</small>
            </article>
          ))}
        </div>
        <div className="reportDuo">
          <article className="reportCard">
            <h3>Risköversikt</h3>
            {riskOverview.map(([label, value]) => (
              <div className="horizontalRisk" key={label}>
                <span>{label}</span>
                <i style={{ width: `${value}%` }} />
                <b>{value}%</b>
              </div>
            ))}
          </article>
          <article className="reportCard">
            <h3>Rekommenderade åtgärder</h3>
            <ol className="numberList">
              {recommendedActions.slice(0, 6).map((action) => <li key={action}>{action}</li>)}
            </ol>
          </article>
        </div>
      </section>

      <section className="reportPage">
        <SectionHeader no="2" title="Fastighetsprofil & överblick" />
        <div className="threeCols">
          <article className="reportCard">
            <h3>Fastigheten</h3>
            <dl className="profileList">
              {profile.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
            </dl>
          </article>
          <article className="reportCard">
            <h3>Riskmatris</h3>
            <div className="riskMatrix">
              {Array.from({ length: 25 }, (_, index) => <span key={index}>{[3, 9, 12, 15].includes(index) ? "•" : ""}</span>)}
            </div>
          </article>
          <article className="reportCard">
            <h3>Topprisker</h3>
            <div className="topRisks">
              {topRisks.map(([risk, priority], index) => (
                <div key={risk}><b>{index + 1}</b><strong>{risk}</strong><span>{priority}</span></div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="reportPage">
        <SectionHeader no="3" title="Installationsregister - värmesystem" />
        <div className="imageTableGrid">
          <div className="equipmentImage heatImage" />
          <table>
            <thead><tr><th>Komponent</th><th>Fabrikat / modell</th><th>Data / dim</th><th>Serie-ID</th><th>År</th><th>Status</th></tr></thead>
            <tbody>{heatRegister.map((row) => <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <div className="lightStrip">
          <strong>Rör- och dimensionsregister</strong>
          <span>Värme stam: Stål 28 mm</span>
          <span>Ber. tappvatten: PEM 32 mm</span>
          <span>Radiatorgren: Koppar 15 mm</span>
          <span>Avlopp huvudstam: Gjutjärn 110 mm</span>
        </div>
      </section>

      <section className="reportPage">
        <SectionHeader no="5" title="Systemdata & driftöversikt" />
        {drift.length > 0 && (
          <>
            <div className="driftGrid">{drift.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            {liveWeather && <p className="weatherSource">Källa utetemperatur: {liveWeather.source}. Uppdateras automatiskt via adressen.</p>}
          </>
        )}
        {(energyTrend.length > 0 || technicalAssessment.length > 0) && (
          <div className="reportDuo">
            {energyTrend.length > 0 && (
              <article className="reportCard chartCard">
                <h3>Energioptimeringspotential</h3>
                <div className="liveBarChart">
                  {energyTrend.map((item) => (
                    <div key={item.label}>
                      <span>{item.label}</span>
                      <i style={{ width: `${item.value}%` }} />
                      <b>{Math.round(item.value)}%</b>
                    </div>
                  ))}
                </div>
              </article>
            )}
            {technicalAssessment.length > 0 && (
              <article className="reportCard">
                <h3>Teknisk bedömning</h3>
                <ul className="dotList">{technicalAssessment.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            )}
          </div>
        )}
      </section>

      <section className="reportPage">
        <SectionHeader no="6" title="Vattensäkerhet, kök & våtrum" />
        {waterItems.length > 0 && (
          <div className="waterIssueGrid">
            {waterItems.map(([label, observation, risk, recommendation, estimate]) => (
              <article className={`waterIssue risk-${risk.toLowerCase()}`} key={`${label}-${observation}`}>
                <header>
                  <strong>{label}</strong>
                  <span>Risk: {risk}</span>
                </header>
                <div><b>Observation</b><p>{observation || "Ingen anmärkning"}</p></div>
                <div><b>Rekommendation</b><p>{recommendation || "Ingen åtgärd rekommenderad"}</p></div>
                <div><b>Estimat</b><p>{estimate || "Pris ej fastställt"}</p></div>
              </article>
            ))}
          </div>
        )}
        {waterItems.length === 0 && <div className="emptyReportState">Vattensäkerhet är inte kontrollerad i valt underlag.</div>}
        {waterPackage && <div className="packageBanner"><strong>{waterPackage[0]}</strong><span>{waterPackage[1]}</span></div>}
      </section>

      <section className="reportPage">
        <SectionHeader no="7" title="20-års åtgärds- och investeringsplan" />
        {plan.length > 0 && (
          <div className="planLayout">
            <article className="reportCard verticalPlan">
              {plan.map(([year, action, prio, cost]) => (
                <div className={`priority-${prio.toLowerCase()}`} key={action}>
                  <time>{year}</time>
                  <strong>{action}</strong>
                  <span>{prio} prioritet</span>
                  <b>{cost || "Pris ej fastställt"}</b>
                </div>
              ))}
            </article>
            <div className="sideStack">
              {investmentTotal && <article className="reportCard investment"><h3>Sammanlagd planerad investering</h3><strong>{investmentTotal}</strong></article>}
              {costBars.length > 0 && (
                <article className="reportCard">
                  <h3>Kostnadstyngdpunkter</h3>
                  <div className="costBars">
                    {costBars.map((bar) => (
                      <div key={bar.label}>
                        <span>{bar.label}</span>
                        <i style={{ width: `${bar.percent}%` }} />
                        <small>{bar.detail}</small>
                      </div>
                    ))}
                  </div>
                </article>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="reportPage">
        <SectionHeader no="8" title="Prioriterad åtgärdsplan & paket" />
        {priorityRows.length > 0 && (
          <table>
            <thead><tr><th>Prio</th><th>Åtgärd</th><th>Varför</th><th>Tid</th><th>Estimat</th><th>Status</th></tr></thead>
            <tbody>
              {priorityRows.map((row) => <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}
            </tbody>
          </table>
        )}
        {packageCards.length > 0 && (
          <div className="packageGrid">
            {packageCards.map(([name, text, price]) => <article className="reportCard packageCard" key={name}><h3>{name}</h3><p>{text}</p><strong>{price}</strong></article>)}
          </div>
        )}
        {priorityRows.length > 0 && (
          <form className="quoteRequestBox noPrint">
            <h3>Begär offert på valda åtgärder</h3>
            {priorityRows.map(([, action, , time, cost]) => (
              <label key={`${action}-${time}`}>
                <input name="quoteActions" type="checkbox" value={action} />
                <span>{action}</span>
                <small>{time} · {cost || "Pris ej fastställt"}</small>
              </label>
            ))}
            <button type="button">Begär offert på valda åtgärder</button>
          </form>
        )}
      </section>

      <section className="reportPage">
        <SectionHeader no="9" title="Utföranderapport, egenkontroll & husjournal" />
        <div className="journalCadence">
          <article><h3>Årligen</h3><ul><li>Kontrollera systemtryck</li><li>Okulär läckagekontroll</li><li>Motionera ventiler</li><li>Kontrollera golvbrunnar</li></ul></article>
          <article><h3>Vartannat år</h3><ul><li>Service värmekälla</li><li>Kontroll av säkerhetsfunktioner</li></ul></article>
          <article><h3>Vid behov</h3><ul><li>Filterservice</li><li>Spolning</li><li>Vattenprov</li></ul></article>
        </div>
        {journalDocs.length > 0 && (
          <div className="reportDuo lightDocs">
            {journalDocs.map((doc) => (
              <article key={doc.title}>
                <h3>{doc.title}</h3>
                {doc.rows.map((row) => <p key={row}>{row}</p>)}
              </article>
            ))}
          </div>
        )}
        {signatures.length > 0 && (
          <div className="reportSignatures">
            {signatures.map((signature) => (
              <article className={signature.valid ? "valid" : "invalid"} key={signature.id}>
                <div>
                  <span>{signature.valid ? "Signerad" : "Kräver ny signering"}</span>
                  <strong>Signerad av: {signature.signedBy}</strong>
                  <p>Roll: {signature.role}</p>
                  <p>Datum: {new Date(signature.signedAt).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <img alt={`Signatur ${signature.signedBy}`} src={signature.imageDataUrl} />
              </article>
            ))}
          </div>
        )}
        {(priorityRows.length > 0 || journalDocs.length > 0) && (
          <div className="journalFlow">
            {["Statuskontroll", "Åtgärdsplan", "Offert", "Utförande", "Husjournal"].map((step, index) => <div key={step}><b>{index + 1}</b><span>{step}</span></div>)}
          </div>
        )}
      </section>
    </main>
  );
}




