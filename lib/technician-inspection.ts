export const inspectionAreas = [
  { id: "heat", title: "Värmesystem" },
  { id: "tapwater", title: "Tappvatten" },
  { id: "hotwater", title: "Varmvatten" },
  { id: "drain", title: "Avlopp" },
  { id: "bathroom", title: "Badrum" },
  { id: "kitchen", title: "Kök" },
  { id: "laundry", title: "Tvättstuga" },
  { id: "technical", title: "Teknikrum" },
  { id: "other", title: "Övrigt" },
] as const;

export type InspectionAreaId = (typeof inspectionAreas)[number]["id"];
export type AreaStatus = "not_started" | "in_progress" | "checked" | "has_findings" | "not_applicable";
export type RiskLevel = "low" | "watch" | "action" | "urgent";
export type ActionTiming = "now" | "3_months" | "6_months" | "12_months" | "1_3_years" | "3_5_years" | "watch" | "none";

export type InspectionPhoto = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  createdAt: string;
  areaId: InspectionAreaId;
  category: "Översikt" | "Installation" | "Produkt" | "Typskylt" | "Brist" | "Före" | "Övrigt";
  linkedId?: string;
};

export type TypePlateExtraction = {
  manufacturer: string;
  model: string;
  type: string;
  serialNo: string;
  manufacturingYear: string;
  power: string;
  voltage: string;
  volume: string;
  rsk: string;
  confidence: Record<string, "high" | "medium" | "low">;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
};

export type InspectionInstallation = {
  id: string;
  areaId: InspectionAreaId;
  type: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  manufacturingYear: string;
  installationYear: string;
  volume: string;
  power: string;
  voltage: string;
  rsk: string;
  placement: string;
  status: "God" | "Bevaka" | "Bör åtgärdas" | "Akut" | "Okänd";
  comment: string;
  photos: InspectionPhoto[];
  typePlate?: TypePlateExtraction;
};

export type InspectionProduct = {
  id: string;
  areaId: InspectionAreaId;
  mode: "existing" | "recommended";
  rsk: string;
  productModelId?: string;
  name: string;
  manufacturer: string;
  model: string;
  category: string;
  technicalInfo: string;
  listPriceSek?: number;
  source: "local_product_database" | "manual";
};

export type InspectionFinding = {
  id: string;
  areaId: InspectionAreaId;
  object: string;
  types: string[];
  riskLevel: RiskLevel;
  timing: ActionTiming;
  recommendedAction: string;
  recommendedProductId?: string;
  workHours?: string;
  comment: string;
  photos: InspectionPhoto[];
  status: "open" | "planned" | "resolved" | "dismissed";
  createdAt: string;
};

export type InspectionAreaState = {
  id: InspectionAreaId;
  status: AreaStatus;
  checkedAt?: string;
  checkedBy?: string;
  comment?: string;
  checks: Record<string, "Ja" | "Nej" | "Ej relevant" | "Ej kontrollerat" | "">;
};

export type TechnicianInspectionState = {
  reportId: string;
  propertyId: string;
  status: "not_started" | "inspection_in_progress" | "review_required";
  inspectorName: string;
  startedAt?: string;
  completedAt?: string;
  customerWalkthroughShown?: boolean;
  areas: Record<InspectionAreaId, InspectionAreaState>;
  installations: InspectionInstallation[];
  products: InspectionProduct[];
  findings: InspectionFinding[];
  photos: InspectionPhoto[];
  verifiedCustomerFields: Record<string, { verified: boolean; verifiedAt: string; verifiedBy: string }>;
};

export const riskLabels: Record<RiskLevel, string> = {
  low: "Låg",
  watch: "Bevaka",
  action: "Bör åtgärdas",
  urgent: "Akut",
};

export const timingLabels: Record<ActionTiming, string> = {
  now: "Omgående",
  "3_months": "Inom 3 månader",
  "6_months": "Inom 6 månader",
  "12_months": "Inom 12 månader",
  "1_3_years": "Inom 1–3 år",
  "3_5_years": "Inom 3–5 år",
  watch: "Bevakas",
  none: "Ingen åtgärd krävs",
};

export const installationTypes = [
  "Värmepump",
  "Panna",
  "Fjärrvärmecentral",
  "Varmvattenberedare",
  "Expansionskärl",
  "Cirkulationspump",
  "Golvvärmefördelare",
  "Vattenmätare",
  "Hydrofor",
  "Hydropress",
  "Pump",
  "Blandare",
  "WC",
  "Golvbrunn",
  "Fördelarskåp",
  "Avstängningsventil",
  "Annat",
];

export const findingObjects = [
  "Blandare",
  "WC",
  "Golvbrunn",
  "Varmvattenberedare",
  "Värmepump",
  "Expansionskärl",
  "Cirkulationspump",
  "Avstängningsventil",
  "Rörledning",
  "Fördelarskåp",
  "Avlopp",
  "Annat",
];

export const findingTypes = [
  "Läckage",
  "Korrosion",
  "Slitage",
  "Hög ålder",
  "Felaktig installation",
  "Saknar avstängning",
  "Dålig funktion",
  "Dåligt tryck",
  "Dåligt flöde",
  "Dålig avrinning",
  "Missljud",
  "Fukt/missfärgning",
  "Saknat läckageskydd",
  "Risk för framtida skada",
  "Annat",
];

export const actionTemplates = [
  "Byt komponent",
  "Montera läckageskydd",
  "Täta och dokumentera genomföring",
  "Utför service och funktionskontroll",
  "Spola/filma avlopp",
  "Planera byte vid nästa service",
  "Komplettera med avstängningsventil",
];

export const areaCheckTemplates: Record<InspectionAreaId, string[]> = {
  heat: ["Normalt systemtryck?", "Expansionskärl skick?", "Cirkulationspump funktion?", "Synligt läckage?", "Onormala ljud?", "Installationens ålder?"],
  tapwater: ["Synliga läckage?", "Korrosion?", "Avstängningsmöjlighet?", "Fördelarskåp?", "Läckageskydd?", "Synliga äldre installationer?"],
  hotwater: ["Normal temperatur?", "Synligt läckage?", "Säkerhetsventil kontrollerad?", "Ålder bedömd?", "Typskylt dokumenterad?"],
  drain: ["Dålig avrinning?", "Lukt?", "Synliga äldre delar?", "Golvbrunn kontrollerad?", "Rensmöjlighet?"],
  bathroom: ["Golvbrunn?", "WC?", "Blandare?", "Avstängning?", "Synliga läckage?", "Avrinning?"],
  kitchen: ["Diskbänksskåp kontrollerat?", "Diskmaskinsunderlägg?", "Avstängning?", "Synliga läckage?", "Kyl/frys vattenanslutning?"],
  laundry: ["Golvbrunn?", "Tvättmaskin?", "Avstängning?", "Läckageskydd?", "Synliga läckage?"],
  technical: ["Översikt dokumenterad?", "Avstängningar markerade?", "Typskyltar fotograferade?", "Serviceutrymme?", "Synliga risker?"],
  other: ["Övriga observationer?", "Kundens önskemål kontrollerat?", "Bilder kompletterade?"],
};

export function emptyInspectionState(reportId: string, propertyId: string, inspectorName = ""): TechnicianInspectionState {
  return {
    reportId,
    propertyId,
    status: "not_started",
    inspectorName,
    areas: Object.fromEntries(
      inspectionAreas.map((area) => [
        area.id,
        {
          id: area.id,
          status: "not_started",
          checks: Object.fromEntries(areaCheckTemplates[area.id].map((question) => [question, ""])),
        },
      ]),
    ) as Record<InspectionAreaId, InspectionAreaState>,
    installations: [],
    products: [],
    findings: [],
    photos: [],
    verifiedCustomerFields: {},
  };
}

export function inspectionProgress(state: TechnicianInspectionState) {
  const areaStates = Object.values(state.areas);
  const done = areaStates.filter((area) => area.status === "checked" || area.status === "has_findings" || area.status === "not_applicable").length;
  return Math.round((done / Math.max(areaStates.length, 1)) * 100);
}

export function inspectionSummary(state: TechnicianInspectionState) {
  const risks = {
    low: state.findings.filter((finding) => finding.riskLevel === "low").length,
    watch: state.findings.filter((finding) => finding.riskLevel === "watch").length,
    action: state.findings.filter((finding) => finding.riskLevel === "action").length,
    urgent: state.findings.filter((finding) => finding.riskLevel === "urgent").length,
  };
  return {
    checkedAreas: Object.values(state.areas).filter((area) => area.status === "checked" || area.status === "has_findings").length,
    missingAreas: Object.values(state.areas).filter((area) => area.status === "not_started" || area.status === "in_progress").length,
    notApplicableAreas: Object.values(state.areas).filter((area) => area.status === "not_applicable").length,
    installations: state.installations.length,
    products: state.products.length,
    photos: state.photos.length + state.installations.reduce((sum, item) => sum + item.photos.length, 0) + state.findings.reduce((sum, item) => sum + item.photos.length, 0),
    findings: state.findings.length,
    urgentFindings: risks.urgent,
    risks,
  };
}
