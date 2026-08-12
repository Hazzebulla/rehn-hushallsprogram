import { prisma } from "../../lib/prisma";
import { getLiveOutdoorTemperature } from "../../lib/weather";
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
  hasCompletedForm: boolean;
  dataSufficient: boolean;
  leadText: string;
  statusCards: string[][];
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
  if (score >= 82) return "God";
  if (score >= 68) return "Normal";
  if (score >= 52) return "Brister att planera";
  if (score >= 38) return "Snar åtgärd";
  return "Akut utredning";
}

function priorityFromStatus(status: string, riskLevel: string) {
  if (status === "RED" || riskLevel === "HIGH") return "Hög";
  if (status === "ORANGE" || status === "YELLOW" || riskLevel === "MEDIUM") return "Medel";
  return "Låg";
}

function costLabel(costCents: number) {
  if (!costCents) return "Uppgift saknas";
  return `${Math.round(costCents / 100).toLocaleString("sv-SE")} kr`;
}

function krLabel(costCents: number) {
  return `${Math.round(costCents / 100).toLocaleString("sv-SE")} kr`;
}

function krRangeLabel(lowCents: number, highCents: number) {
  if (!lowCents && !highCents) return "";
  if (lowCents === highCents) return krLabel(lowCents);
  return `${krLabel(lowCents)}-${krLabel(highCents)}`;
}

function numberAnswer(answers: Map<string, string>, key: string) {
  const value = Number(String(answers.get(key) ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function textAnswer(answers: Map<string, string>, key: string) {
  return String(answers.get(key) ?? "").trim();
}

function hasAnyAnswer(answers: Map<string, string>, keys: string[]) {
  return keys.some((key) => textAnswer(answers, key).length > 0);
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

async function getReportData(propertyId?: string): Promise<ReportData> {
  try {
    const property = await prisma.property.findFirst({
      where: propertyId ? { id: propertyId, companyId: "org_rehn_vvs" } : { companyId: "org_rehn_vvs" },
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
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
    }) as Awaited<ReturnType<typeof prisma.property.findFirst>> & {
      customer?: { name: string };
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
        hasCompletedForm: false,
        dataSufficient: false,
        leadText: "Ingen färdig RVM Husstatusrapport finns ännu. Välj fastighet och slutför formuläret för att skapa rapport.",
        statusCards: [
          ["Rapportstatus", "Ej klar", "0 % formulär", "cyan"],
          ["Riskindex", "Ej beräknat", "Underlag saknas", "gold"],
          ["Teknisk status", "Ej bedömd", "Systemet gissar inte", "gold"],
          ["Publicering", "Stängd", "Kund ser inget ännu", "gold"],
        ],
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
        topRisks: [],
        recommendedActions: ["Slutför RVM Husstatus-formuläret för fastigheten."],
        riskOverview: [],
      };
    }

    const draftSubmission = await prisma.formSubmission.findFirst({
      where: {
        companyId: "org_rehn_vvs",
        status: "DRAFT",
        inspection: { propertyId: property.id, companyId: "org_rehn_vvs" },
      },
      include: { answers: true, inspection: true },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    const completedSubmission = await prisma.formSubmission.findFirst({
      where: {
        companyId: "org_rehn_vvs",
        status: { not: "DRAFT" },
        inspection: { propertyId: property.id, companyId: "org_rehn_vvs" },
      },
      include: { answers: true, inspection: true },
      orderBy: [{ signedAt: "desc" }, { createdAt: "desc" }],
    });
    const directSubmission = draftSubmission ?? completedSubmission;
    const latestSubmission = directSubmission ?? property.inspections?.[0]?.submissions[0];
    const latestReport = property.houseReports?.[0];
    const liveOutdoor = await getLiveOutdoorTemperature(`${property.address}, ${property.propertyNo ?? ""}`);
    const liveWeather = liveOutdoor
      ? {
          value: `${liveOutdoor.temperature.toFixed(1).replace(".", ",")} ${liveOutdoor.unit}`,
          source: `${liveOutdoor.provider} live, ${liveOutdoor.place}${liveOutdoor.measuredAt ? ` ${liveOutdoor.measuredAt.replace("T", " ")}` : ""}`,
        }
      : undefined;
    const latestRawAnswers = new Map<string, unknown>(
      latestSubmission?.answers.map((answer) => [answer.fieldKey, rawAnswerValue(answer.value)]) ?? [],
    );
    const latestAnswers = new Map<string, string>(
      latestSubmission?.answers.map((answer) => [answer.fieldKey, answerValue(answer.value)]) ?? [],
    );
    const answeredFields = Array.from(latestAnswers.entries()).filter(([key, value]) => {
      if (key.endsWith("__source") || key.endsWith("__photos")) return false;
      return reportAnswerFieldKeys.has(key) && value.trim().length > 0;
    }).length;
    const formProgress = Math.min(100, Math.round((answeredFields / rvmFieldCount) * 100));
    const hasCompletedForm = latestSubmission?.status === "SUBMITTED" || latestSubmission?.status === "COMPLETED";
    const dataSufficient = answeredFields >= 12;
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
      : ([
          ["Värmesystem", Math.max(18, risk)],
          ["Tappvatten", 28],
          ["Avlopp", 24],
          ["Vattensäkerhet", 36],
        ] as Array<[string, number]>);

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
        ? topRisks.map(([name, prio]) => `${prio === "Hög" ? "Åtgärda" : "Följ upp"} ${name}`)
        : [nextAction]),
      ...(annualControlEnabled ? ["Lägg in årlig kontroll av värme, tryck, filter och säkerhetsfunktion"] : []),
      ...(quarterlyControlEnabled ? [`Skicka kvartalsvis kontrollöversyn${deliveryMethod ? ` via ${deliveryMethod.toLowerCase()}` : ""}`] : []),
    ];

    const rawDriftRows: Array<[string, string | number | undefined, string] | undefined> = [
      liveWeather ? ["Utetemp live", liveWeather.value, ""] : undefined,
      ["Utetemp kontroll", numberAnswer(latestAnswers, "outdoor_temp_c"), "°C"],
      ["Innetemp", textAnswer(latestAnswers, "residents_temp") || undefined, ""],
      ["Framledning", numberAnswer(latestAnswers, "supply_temp_c"), "°C"],
      ["Retur", numberAnswer(latestAnswers, "return_temp_c"), "°C"],
      ["Brine in", numberAnswer(latestAnswers, "brine_in_c"), "°C"],
      ["Brine ut", numberAnswer(latestAnswers, "brine_out_c"), "°C"],
      ["VV nära", numberAnswer(latestAnswers, "nearest_tap_c"), "°C"],
      ["VV längst bort", numberAnswer(latestAnswers, "furthest_tap_c"), "°C"],
    ];
    const driftRows = rawDriftRows
      .filter((row): row is [string, string | number | undefined, string] => Boolean(row))
      .filter(([, value]) => value !== undefined && String(value).trim().length > 0)
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
      supply !== undefined ? { label: "Framledning", value: Math.max(4, Math.min(100, supply * 1.8)) } : undefined,
      ret !== undefined ? { label: "Retur", value: Math.max(4, Math.min(100, ret * 1.8)) } : undefined,
      brineIn !== undefined ? { label: "Brine in", value: Math.max(4, Math.min(100, (brineIn + 20) * 3)) } : undefined,
      brineOut !== undefined ? { label: "Brine ut", value: Math.max(4, Math.min(100, (brineOut + 20) * 3)) } : undefined,
      electricity !== undefined ? { label: "El kWh", value: Math.max(4, Math.min(100, electricity / 260)) } : undefined,
      waterUse !== undefined ? { label: "Vatten", value: Math.max(4, Math.min(100, waterUse / 2.5)) } : undefined,
    ].filter(Boolean) as BarDatum[];

    const technicalAssessment = [
      supply !== undefined && ret !== undefined ? `Temperaturdifferens värme: ${Math.abs(supply - ret).toFixed(1).replace(".", ",")} °C.` : "",
      brineIn !== undefined && brineOut !== undefined ? `Köldbärardifferens: ${Math.abs(brineIn - brineOut).toFixed(1).replace(".", ",")} °C.` : "",
      vvNear !== undefined && vvFar !== undefined ? `Varmvattenfall mellan nära och längst bort: ${Math.abs(vvNear - vvFar).toFixed(1).replace(".", ",")} °C.` : "",
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
      hasCompletedForm,
      dataSufficient,
      leadText: dataSufficient
        ? String(latestAnswers.get("site_summary") || explanation.summary || (hasCompletedForm
            ? "Rapporten bygger på senast slutfört RVM Husstatus-formulär. Saknade uppgifter markeras som uppgift saknas och ska inte gissas."
            : "Rapporten bygger på autosparat arbetsunderlag från formuläret. Granska och slutför formuläret innan rapporten publiceras till kund."))
        : "Fyll i fler centrala formulärfält innan risk, teknisk status och åtgärdsplan används som beslutsunderlag.",
      statusCards: dataSufficient
        ? [
            ["Totalt riskindex", `${risk}%`, risk >= 60 ? "Hög risk" : risk >= 35 ? "Medel risk" : "Låg risk", "cyan"],
            ["Energipotential", latestAnswers.get("energy_notes") || latestAnswers.get("electricity_kwh") ? "Bedömd" : "Ej kontrollerat", "Från formulär", "cyan"],
            ["Teknisk status", `${health}%`, statusLabel(health), "green"],
            ["Prioriterade åtgärder", String(Math.max(highPriority, recommendedActions.length)), "Aktuella", "gold"],
          ]
        : [
            ["Rapportstatus", hasCompletedForm ? "Granskas" : "Arbetsläge", `${formProgress} % formulär`, "cyan"],
            ["Underlag", `${answeredFields}`, "ifyllda fält", "cyan"],
            ["Riskindex", "Ej beräknat", "Underlag saknas", "gold"],
            ["Teknisk status", "Ej bedömd", "Systemet gissar inte", "gold"],
          ],
      profile: [
        ["Kund", property.customer?.name ?? "Uppgift saknas"],
        ["Fastighet", property.propertyNo ?? "Uppgift saknas"],
        ["Adress", property.address],
        ["Byggår", property.buildYear?.toString() ?? latestAnswers.get("build_year") ?? "Uppgift saknas"],
        ["Värmekälla", heating],
        ["Omfattning", latestAnswers.get("scope") ?? "Uppgift saknas"],
        ["Grundläggning", latestAnswers.get("foundation") ?? "Uppgift saknas"],
        ["Vatten / avlopp", latestAnswers.get("water_source") ?? "Uppgift saknas"],
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
      hasCompletedForm: false,
      dataSufficient: false,
      leadText: "Rapportdata kunde inte laddas från databasen.",
      statusCards: [
        ["Rapportstatus", "Offline", "Databasen svarar inte", "gold"],
        ["Riskindex", "Ej beräknat", "Underlag saknas", "gold"],
        ["Teknisk status", "Ej bedömd", "Systemet gissar inte", "gold"],
        ["Publicering", "Stängd", "Kund ser inget ännu", "gold"],
      ],
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
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const [reportData, reportProperties] = await Promise.all([
    getReportData(params?.propertyId),
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
    hasCompletedForm,
    dataSufficient,
    leadText,
    statusCards,
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
    topRisks,
    recommendedActions,
    riskOverview,
  } = reportData;
  const reportHref = propertyId ? `/husrapport?propertyId=${propertyId}` : "/husrapport";
  const dataExportHref = propertyId ? `/api/husrapport/export?propertyId=${propertyId}` : "/api/husrapport/export";
  const formDataPdfHref = propertyId ? `/api/husrapport/form-data-pdf?propertyId=${propertyId}` : "/api/husrapport/form-data-pdf";

  return (
    <main className="statusReport">
      <nav className="modeNav inline noPrint" aria-label="Demo navigation">
        <a href="/">Omslag</a>
        <a className="active" href={reportHref}>Status Husrapport</a>
        <a href="/portal">Kundkonto</a>
        <a href="/admin">SaaS-system</a>
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
          <a className="buttonLink" href={propertyId ? `/admin/husstatus-form?propertyId=${propertyId}` : "/admin/husstatus-form"}>
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

      {!hasCompletedForm && dataSufficient && (
        <section className="reportGate noPrint">
          <strong>Arbetsläge - ej publicerad kundrapport.</strong>
          <p>Status, risk och åtgärder beräknas från det autosparade formuläret. Slutför och granska formuläret innan rapporten används som kundversion.</p>
          <a className="buttonLink" href={propertyId ? `/admin/husstatus-form?propertyId=${propertyId}` : "/admin/husstatus-form"}>Fortsätt formulär</a>
        </section>
      )}

      {!hasCompletedForm && !dataSufficient && (
        <section className="reportGate noPrint">
          <strong>Mer underlag behövs.</strong>
          <p>Fyll i fler centrala formulärfält för den valda fastigheten. Rapporten börjar bedöma risk och teknisk status när minst 12 riktiga formulärfält är ifyllda.</p>
          <a className="buttonLink" href={propertyId ? `/admin/husstatus-form?propertyId=${propertyId}` : "/admin/husstatus-form"}>Fyll i formulär</a>
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
        <p className="leadText">
          {leadText}
        </p>
        <div className="statusMetricGrid">
          {statusCards.map(([label, value, sub, tone]) => (
            <article className="statusMetric" key={label}>
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
                <h3>Energianvändning & potential</h3>
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
        {waterCards.length > 0 && (
          <div className="waterCards">
            {waterCards.map(([label, risk]) => <div key={label}><strong>{label}</strong><span>{risk}</span></div>)}
          </div>
        )}
        {waterItems.length > 0 && (
          <table>
            <thead><tr><th>Kontrollpunkt</th><th>Observation</th><th>Risk</th><th>Rekommendation</th><th>Estimat</th></tr></thead>
            <tbody>{waterItems.map((row) => <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
          </table>
        )}
        {waterPackage && <div className="packageBanner"><strong>{waterPackage[0]}</strong><span>{waterPackage[1]}</span></div>}
      </section>

      <section className="reportPage">
        <SectionHeader no="7" title="20-års åtgärds- och investeringsplan" />
        {plan.length > 0 && (
          <div className="planLayout">
            <article className="reportCard verticalPlan">
              {plan.map(([year, action, prio, cost]) => <div key={action}><time>{year}</time><strong>{action}</strong><span>{prio}</span><b>{cost}</b></div>)}
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
      </section>

      <section className="reportPage">
        <SectionHeader no="9" title="Utföranderapport, egenkontroll & husjournal" />
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
        {(priorityRows.length > 0 || journalDocs.length > 0) && (
          <div className="journalFlow">
            {["Statuskontroll", "Åtgärdsplan", "Offert", "Utförande", "Husjournal"].map((step, index) => <div key={step}><b>{index + 1}</b><span>{step}</span></div>)}
          </div>
        )}
      </section>
    </main>
  );
}



