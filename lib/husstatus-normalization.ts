import { parseComponentInput, type ParsedComponentInputRow } from "./component-input-parser";

export type HusstatusAnswers = Record<string, unknown>;

export type NormalizedComponentRow = ParsedComponentInputRow & {
  sourceFieldKey?: string;
  yearSource?: string;
};

export type NormalizedMeasurement = {
  key: string;
  label: string;
  value?: number;
  unit: string;
  measurementStatus: "Mätt" | "Ej mätt" | "Ej aktuellt" | "Ej åtkomligt";
  source: string;
  verifiedAt?: string;
  verifiedBy?: string;
};

export type NormalizedObservation = {
  sectionId: number;
  sectionTitle: string;
  controlPointId: string;
  title: string;
  type: "Informationspunkt" | "Förebyggande förbättring" | "Teknisk brist" | "Allvarlig brist" | "Ej bedömd";
  risk: "Låg" | "Medel" | "Hög";
  text: string;
  recommendation: string;
};

export type NormalizedHusstatus = {
  components: NormalizedComponentRow[];
  measurements: NormalizedMeasurement[];
  observations: NormalizedObservation[];
  technicalAnswers: HusstatusAnswers;
  salesAnswers: HusstatusAnswers;
};

const measurementFields = [
  ["static_pressure_bar", "Statisk vattentryck", "bar"],
  ["dynamic_pressure_bar", "Dynamiskt vattentryck", "bar"],
  ["flow_l_min", "Flöde vid tappunkt", "l/min"],
  ["hot_water_out_c", "Varmvatten produktion", "°C"],
  ["nearest_tap_c", "Närmaste tappställe", "°C"],
  ["furthest_tap_c", "Längst bort tappställe", "°C"],
  ["time_to_50_sec", "Tid till 50 °C", "sek"],
  ["brine_in_c", "Brine in", "°C"],
  ["brine_out_c", "Brine ut", "°C"],
  ["brine_pressure_bar", "Köldbärartryck", "bar"],
  ["supply_temp_c", "Framledning värme", "°C"],
  ["return_temp_c", "Returledning värme", "°C"],
  ["heat_pressure_bar", "Systemtryck värme", "bar"],
  ["electricity_kwh", "Årsförbrukning el", "kWh"],
  ["water_m3", "Årsförbrukning vatten", "m³"],
] as const;

const componentFields = [
  ["well_pump", "Brunnspump", "Vatten"],
  ["hydropress", "Hydrofor/hydropress", "Vatten"],
  ["filter_type", "Partikelfilter", "Vattenrening"],
  ["hot_water_product", "Varmvattenberedare", "Varmvatten"],
  ["mixing_valve", "Blandningsventil", "Tappvatten"],
  ["heat_source_product", "Värmepanna", "Värmesystem"],
  ["circulation_pump", "Cirkulationspump", "Värmesystem"],
  ["expansion_vessel", "Expansionskärl", "Värmesystem"],
  ["safety_valve", "Säkerhetsventil", "Säkerhetsfunktioner"],
  ["valve_type", "Radiatorventil", "Värmesystem"],
  ["floor_drain", "Golvbrunn", "Avlopp"],
  ["bathroom_1_drain", "Golvbrunn", "Avlopp"],
  ["laundry_drain", "Golvbrunn", "Avlopp"],
] as const;

const salesKeys = new Set([
  "rvm_service_agreement",
  "annual_control",
  "quarterly_control",
  "quarterly_delivery",
  "next_control",
  "followup_owner",
  "digital_self_check",
  "customer_report_delivery",
  "customer_contact_preference",
  "customer_next_message",
  "create_quote",
]);

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function numericValue(value: unknown) {
  const raw = clean(value);
  if (!raw) return undefined;
  const number = Number(raw.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : undefined;
}

export function measurementStatusFor(answers: HusstatusAnswers, key: string): NormalizedMeasurement["measurementStatus"] {
  const explicit = clean(answers[`${key}__measurement_status`]);
  if (explicit === "Mätt" || explicit === "Ej mätt" || explicit === "Ej aktuellt" || explicit === "Ej åtkomligt") return explicit;
  return numericValue(answers[key]) === undefined ? "Ej mätt" : "Mätt";
}

export function measuredNumber(answers: HusstatusAnswers, key: string) {
  if (measurementStatusFor(answers, key) !== "Mätt") return undefined;
  return numericValue(answers[key]);
}

function sourceFor(answers: HusstatusAnswers, key: string) {
  return clean(answers[`${key}__source`]) || "RVM verifierat";
}

function verifiedBy(answers: HusstatusAnswers) {
  return clean(answers.rvm_signer) || clean(answers.inspection_owner) || undefined;
}

function buildMeasurements(answers: HusstatusAnswers): NormalizedMeasurement[] {
  return measurementFields.map(([key, label, unit]) => ({
    key,
    label,
    value: measuredNumber(answers, key),
    unit,
    measurementStatus: measurementStatusFor(answers, key),
    source: sourceFor(answers, key),
    verifiedAt: measurementStatusFor(answers, key) === "Mätt" ? new Date().toISOString() : undefined,
    verifiedBy: verifiedBy(answers),
  }));
}

function enrichRow(row: NormalizedComponentRow, answers: HusstatusAnswers, sourceFieldKey: string, fallbackType: string, fallbackCategory: string): NormalizedComponentRow {
  const source = clean(row.installedYear) ? sourceFor(answers, sourceFieldKey) : "Okänt";
  return {
    ...row,
    typeName: row.typeName && row.typeName !== "Kontrollera" ? row.typeName : fallbackType,
    category: row.category && row.category !== "Övrigt" ? row.category : fallbackCategory,
    systemName: row.systemName || fallbackCategory,
    installedYear: clean(row.installedYear),
    status: clean(row.status) && row.status !== "Ej valt" ? row.status : "Ej valt",
    location: clean(row.location),
    yearSource: source,
    sourceFieldKey,
  };
}

function dedupeKey(row: NormalizedComponentRow) {
  return [
    normalized(row.typeName),
    normalized(row.brand),
    normalized(row.model),
    normalized(row.serialNo),
    normalized(row.location),
  ].filter(Boolean).join("|");
}

function rowHasValue(row: NormalizedComponentRow) {
  return [row.typeName, row.brand, row.model, row.serialNo, row.installedYear, row.location].some((value) => clean(value).length > 0);
}

function buildComponents(answers: HusstatusAnswers): NormalizedComponentRow[] {
  const explicitRows = Array.isArray(answers.component_register_rows)
    ? (answers.component_register_rows as NormalizedComponentRow[]).filter(rowHasValue)
    : [];
  const inferredRows = componentFields.flatMap(([key, fallbackType, fallbackCategory]) => {
    const text = clean(answers[key]);
    if (!text || /^(ej aktuellt|saknas|nej|okänt)$/i.test(text)) return [];
    return parseComponentInput(`${fallbackType} ${text}`).map((row) => enrichRow(row, answers, key, fallbackType, fallbackCategory));
  });

  const rows: NormalizedComponentRow[] = [];
  const seen = new Set<string>();
  for (const row of [...explicitRows, ...inferredRows]) {
    const enriched = {
      ...row,
      replacementYear: row.replacementYear ?? "",
      replacementPeriod: row.replacementPeriod ?? "",
      costKr: row.costKr ?? "",
      comment: row.comment ?? "",
    } as NormalizedComponentRow;
    const key = dedupeKey(enriched) || `${normalized(enriched.typeName)}|${normalized(enriched.sourceFieldKey)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(enriched);
  }

  return rows;
}

function observationType(value: string): NormalizedObservation["type"] {
  const text = normalized(value);
  if (/akut|aktiv lack|vattenskada|allvar/.test(text)) return "Allvarlig brist";
  if (/om .*lack|svart att marka|svårt att märka|forebygg|förbättring|forbattring|rekommenderas|bor/.test(text)) return "Förebyggande förbättring";
  if (/brist|avvikelse|saknas|ej godk|otat|lackage/.test(text)) return "Teknisk brist";
  if (/ej bedom|ej bedömd|okant|okänt/.test(text)) return "Ej bedömd";
  return "Informationspunkt";
}

function riskForObservation(type: NormalizedObservation["type"]) {
  if (type === "Allvarlig brist") return "Hög";
  if (type === "Teknisk brist" || type === "Förebyggande förbättring") return "Medel";
  return "Låg";
}

function buildObservations(answers: HusstatusAnswers): NormalizedObservation[] {
  const items: Array<[number, string, string, string, string]> = [
    [13, "Kök", "kitchen_waterproof_base", "Tät botten/läckageindikering", "Täta botten eller komplettera läckageindikering under kök."],
    [13, "Kök", "water_alarm", "Läckagelarm/vattenfelsbrytare", "Komplettera med läckagesensor eller vattenfelsbrytare där risken motiverar det."],
    [13, "Kök", "kitchen_notes", "Köksobservation", "Följ upp observationen vid åtgärdsplanering."],
    [12, "Avlopp", "known_stops", "Kända stopp/lukt", "Filma eller spola avlopp vid symptom eller okänd status."],
    [12, "Avlopp", "sewer_film", "Filmning/spolning", "Planera endast filmning/spolning när symptom eller okänd status finns."],
    [15, "Tvättstuga", "laundry_alarm", "Läckagelarm tvättstuga", "Komplettera skydd om installationen kräver det."],
  ];

  return items.flatMap(([sectionId, sectionTitle, key, title, recommendation]) => {
    const text = clean(answers[key]);
    if (!text || /^(ok|nej|finns|kontrollerat)$/i.test(text)) return [];
    const type = observationType(text);
    return [{
      sectionId,
      sectionTitle,
      controlPointId: key,
      title,
      type,
      risk: riskForObservation(type),
      text,
      recommendation,
    }];
  });
}

export function normalizeHusstatus(answers: HusstatusAnswers): NormalizedHusstatus {
  const measurements = buildMeasurements(answers);
  const components = buildComponents(answers);
  const observations = buildObservations(answers);
  const technicalAnswers = Object.fromEntries(
    Object.entries(answers).filter(([key]) => !salesKeys.has(key)),
  );
  const salesAnswers = Object.fromEntries(
    Object.entries(answers).filter(([key]) => salesKeys.has(key)),
  );

  return { components, measurements, observations, technicalAnswers, salesAnswers };
}
