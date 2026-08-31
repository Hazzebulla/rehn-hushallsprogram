export type HuscheckPhotoLike = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
  createdAt?: string;
};

export type HuscheckPayloadLike = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  propertyType?: string;
  buildYear?: string;
  livingArea?: string;
  floors?: string;
  heating?: string[];
  heatPumpBrand?: string;
  heatPumpModel?: string;
  heatPumpYear?: string;
  heatPumpWorks?: string;
  heatPumpAlarms?: string;
  heatPumpService?: string;
  heatPumpPhotos?: HuscheckPhotoLike[];
  hotWaterType?: string;
  waterHeaterBrand?: string;
  waterHeaterModel?: string;
  waterHeaterYear?: string;
  waterHeaterSize?: string;
  hotWaterProblems?: string;
  waterHeaterPhotos?: HuscheckPhotoLike[];
  heatDistribution?: string;
  radiatorsWarm?: string;
  coldRadiators?: string;
  valvesChanged?: string;
  floorHeatingType?: string;
  floorHeatingAreas?: string;
  floorHeatingYear?: string;
  coldRooms?: string;
  problems?: string[];
  problemDescription?: string;
  recentWork?: string;
  recentWorkDescription?: string;
  otherPhotos?: HuscheckPhotoLike[];
};

export type StoredCustomerAnswer = {
  questionId: string;
  questionLabel: string;
  section: string;
  answer: unknown;
  answerType: "text" | "number" | "select" | "multi_select" | "photo";
  formVersion: number;
};

export type CustomerAnswerGroup = {
  id: string;
  title: string;
  items: Array<{
    key: string;
    label: string;
    value: string;
    answered: boolean;
    answerType?: string;
    source?: "customer" | "derived";
  }>;
};

export type CustomerAnswerHighlight = {
  tone: "warning" | "info";
  text: string;
};

export type CustomerSelfDeclaration = {
  submittedAt: string;
  source: string;
  formVersion: number;
  answers: StoredCustomerAnswer[];
  highlights: CustomerAnswerHighlight[];
  answeredQuestions: number;
  totalQuestions: number;
  imageCount: number;
  legacySummary: {
    heating: string[];
    problems: string[];
    hotWaterType: string;
    heatDistribution: string;
    bookedControl: boolean;
  };
};

const unanswered = "Ej besvarat";

const huscheckQuestions: Array<{
  id: keyof HuscheckPayloadLike;
  label: string;
  section: string;
  answerType: StoredCustomerAnswer["answerType"];
}> = [
  { id: "firstName", label: "Förnamn", section: "Kunduppgifter", answerType: "text" },
  { id: "lastName", label: "Efternamn", section: "Kunduppgifter", answerType: "text" },
  { id: "phone", label: "Telefonnummer", section: "Kunduppgifter", answerType: "text" },
  { id: "email", label: "E-post", section: "Kunduppgifter", answerType: "text" },
  { id: "address", label: "Adress", section: "Kunduppgifter", answerType: "text" },
  { id: "postalCode", label: "Postnummer", section: "Kunduppgifter", answerType: "text" },
  { id: "city", label: "Ort", section: "Kunduppgifter", answerType: "text" },
  { id: "propertyType", label: "Fastighetstyp", section: "Fastigheten", answerType: "select" },
  { id: "buildYear", label: "Byggår", section: "Fastigheten", answerType: "number" },
  { id: "livingArea", label: "Ungefärlig boyta", section: "Fastigheten", answerType: "number" },
  { id: "floors", label: "Antal våningar", section: "Fastigheten", answerType: "number" },
  { id: "heating", label: "Hur värms huset idag?", section: "Värmesystem", answerType: "multi_select" },
  { id: "heatPumpBrand", label: "Värmepump fabrikat", section: "Värmepump", answerType: "text" },
  { id: "heatPumpModel", label: "Värmepump modell", section: "Värmepump", answerType: "text" },
  { id: "heatPumpYear", label: "Värmepump installationsår", section: "Värmepump", answerType: "number" },
  { id: "heatPumpWorks", label: "Fungerar värmepumpen normalt?", section: "Värmepump", answerType: "select" },
  { id: "heatPumpAlarms", label: "Fel eller larm på värmepump", section: "Värmepump", answerType: "text" },
  { id: "heatPumpService", label: "Senaste service", section: "Värmepump", answerType: "text" },
  { id: "heatPumpPhotos", label: "Bilder på värmepump / typplåt", section: "Värmepump", answerType: "photo" },
  { id: "hotWaterType", label: "Hur görs varmvatten i huset?", section: "Varmvatten", answerType: "select" },
  { id: "waterHeaterBrand", label: "Varmvattenberedare fabrikat", section: "Varmvatten", answerType: "text" },
  { id: "waterHeaterModel", label: "Varmvattenberedare modell", section: "Varmvatten", answerType: "text" },
  { id: "waterHeaterYear", label: "Varmvattenberedare installationsår", section: "Varmvatten", answerType: "number" },
  { id: "waterHeaterSize", label: "Varmvattenberedare storlek", section: "Varmvatten", answerType: "text" },
  { id: "hotWaterProblems", label: "Problem med varmvatten", section: "Varmvatten", answerType: "text" },
  { id: "waterHeaterPhotos", label: "Bilder på varmvattenberedare", section: "Varmvatten", answerType: "photo" },
  { id: "heatDistribution", label: "Hur sprids värmen i huset?", section: "Värmedistribution", answerType: "select" },
  { id: "radiatorsWarm", label: "Blir alla radiatorer varma?", section: "Värmedistribution", answerType: "select" },
  { id: "coldRadiators", label: "Kalla radiatorer", section: "Värmedistribution", answerType: "text" },
  { id: "valvesChanged", label: "Termostater eller ventiler bytta", section: "Värmedistribution", answerType: "text" },
  { id: "floorHeatingType", label: "Golvvärme", section: "Golvvärme", answerType: "select" },
  { id: "floorHeatingAreas", label: "Golvvärme, delar av huset", section: "Golvvärme", answerType: "text" },
  { id: "floorHeatingYear", label: "Golvvärme installationsår", section: "Golvvärme", answerType: "number" },
  { id: "coldRooms", label: "Rum som känns kallare", section: "Golvvärme", answerType: "text" },
  { id: "problems", label: "Saker kunden vill att vi tittar extra på", section: "Kundens önskemål", answerType: "multi_select" },
  { id: "problemDescription", label: "Beskrivning av problem", section: "Kundens önskemål", answerType: "text" },
  { id: "recentWork", label: "VVS-arbete gjort de senaste åren", section: "Kundens önskemål", answerType: "select" },
  { id: "recentWorkDescription", label: "Vad gjordes och ungefär när?", section: "Kundens önskemål", answerType: "text" },
  { id: "otherPhotos", label: "Bilder på annat problemområde", section: "Kundens önskemål", answerType: "photo" },
];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function answerHasValue(value: unknown) {
  if (Array.isArray(value)) return value.some(answerHasValue);
  if (value && typeof value === "object") return Object.values(value).some(answerHasValue);
  return clean(value).length > 0;
}

function photoSummary(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((photo) => {
    const record = photo && typeof photo === "object" ? photo as HuscheckPhotoLike : {};
    return {
      id: record.id ?? "",
      name: record.name ?? "Bild",
      mimeType: record.mimeType ?? "",
      size: record.size ?? 0,
      createdAt: record.createdAt ?? "",
    };
  });
}

function answerValue(payload: HuscheckPayloadLike, questionId: keyof HuscheckPayloadLike) {
  const value = payload[questionId];
  return questionId.toLowerCase().includes("photos") ? photoSummary(value) : value ?? "";
}

export function formatCustomerAnswer(value: unknown): string {
  if (!answerHasValue(value)) return unanswered;
  if (Array.isArray(value)) {
    const photos = value.filter((item) => item && typeof item === "object" && ("name" in (item as Record<string, unknown>) || "id" in (item as Record<string, unknown>)));
    if (photos.length === value.length) return `${photos.length} bild${photos.length === 1 ? "" : "er"}`;
    return value.map(formatCustomerAnswer).filter((item) => item !== unanswered).join(", ") || unanswered;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("name" in record) return String(record.name ?? "Bild");
    return Object.entries(record)
      .filter(([key]) => key !== "dataUrl")
      .map(([key, entry]) => `${key}: ${formatCustomerAnswer(entry)}`)
      .join(" · ");
  }
  return String(value);
}

export function buildCustomerSelfDeclaration(payload: HuscheckPayloadLike, submittedAt = new Date()): CustomerSelfDeclaration {
  const formVersion = 1;
  const answers = huscheckQuestions.map((question): StoredCustomerAnswer => ({
    questionId: String(question.id),
    questionLabel: question.label,
    section: question.section,
    answer: answerValue(payload, question.id),
    answerType: question.answerType,
    formVersion,
  }));
  const answeredQuestions = answers.filter((answer) => answerHasValue(answer.answer)).length;
  const problems = Array.isArray(payload.problems) ? payload.problems.filter((item) => item && item !== "Inga kända problem") : [];
  const imageCount = ["heatPumpPhotos", "waterHeaterPhotos", "otherPhotos"].reduce((sum, key) => {
    const value = payload[key as keyof HuscheckPayloadLike];
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);

  return {
    submittedAt: submittedAt.toISOString(),
    source: "Kunduppgift – ej verifierad",
    formVersion,
    answers,
    highlights: importantCustomerSignalsFromAnswers(answers),
    answeredQuestions,
    totalQuestions: answers.length,
    imageCount,
    legacySummary: {
      heating: Array.isArray(payload.heating) ? payload.heating : [],
      problems,
      hotWaterType: clean(payload.hotWaterType),
      heatDistribution: clean(payload.heatDistribution),
      bookedControl: false,
    },
  };
}

function normalizeStoredDeclaration(value: unknown): CustomerSelfDeclaration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.answers)) return null;
  const answers = record.answers.flatMap((item): StoredCustomerAnswer[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const answer = item as Record<string, unknown>;
    return [{
      questionId: clean(answer.questionId),
      questionLabel: clean(answer.questionLabel),
      section: clean(answer.section) || "Kundens Huscheck",
      answer: answer.answer,
      answerType: (clean(answer.answerType) || "text") as StoredCustomerAnswer["answerType"],
      formVersion: Number(answer.formVersion) || 1,
    }];
  });

  return {
    submittedAt: clean(record.submittedAt),
    source: clean(record.source) || "Kunduppgift – ej verifierad",
    formVersion: Number(record.formVersion) || 1,
    answers,
    highlights: Array.isArray(record.highlights) ? record.highlights as CustomerAnswerHighlight[] : importantCustomerSignalsFromAnswers(answers),
    answeredQuestions: Number(record.answeredQuestions) || answers.filter((answer) => answerHasValue(answer.answer)).length,
    totalQuestions: Number(record.totalQuestions) || answers.length,
    imageCount: Number(record.imageCount) || answers.filter((answer) => answer.answerType === "photo" && answerHasValue(answer.answer)).length,
    legacySummary: record.legacySummary && typeof record.legacySummary === "object"
      ? record.legacySummary as CustomerSelfDeclaration["legacySummary"]
      : { heating: [], problems: [], hotWaterType: "", heatDistribution: "", bookedControl: false },
  };
}

export function groupedCustomerAnswersFromDeclaration(value: unknown): CustomerAnswerGroup[] {
  const declaration = normalizeStoredDeclaration(value);
  if (!declaration) return [];
  const sections = Array.from(new Set(declaration.answers.map((answer) => answer.section)));
  return sections.map((section) => ({
    id: section.toLowerCase().replace(/\s+/g, "-"),
    title: section,
    items: declaration.answers
      .filter((answer) => answer.section === section)
      .map((answer) => ({
        key: answer.questionId,
        label: answer.questionLabel,
        value: formatCustomerAnswer(answer.answer),
        answered: answerHasValue(answer.answer),
        answerType: answer.answerType,
        source: "customer" as const,
      })),
  }));
}

export function customerDeclarationStats(value: unknown) {
  const declaration = normalizeStoredDeclaration(value);
  if (!declaration) return { answeredQuestions: 0, totalQuestions: 0, imageCount: 0, highlights: [] as CustomerAnswerHighlight[], submittedAt: "" };
  return {
    answeredQuestions: declaration.answeredQuestions,
    totalQuestions: declaration.totalQuestions,
    imageCount: declaration.imageCount,
    highlights: declaration.highlights.length ? declaration.highlights : importantCustomerSignalsFromAnswers(declaration.answers),
    submittedAt: declaration.submittedAt,
  };
}

export function importantCustomerSignalsFromAnswers(answers: StoredCustomerAnswer[]): CustomerAnswerHighlight[] {
  const signals: CustomerAnswerHighlight[] = [];
  const add = (tone: CustomerAnswerHighlight["tone"], text: string) => {
    if (!signals.some((signal) => signal.text === text)) signals.push({ tone, text });
  };

  for (const answer of answers) {
    const value = formatCustomerAnswer(answer.answer);
    const haystack = `${answer.questionLabel} ${value}`.toLowerCase();
    if (value === unanswered) continue;
    if (/läck|vattenskada/.test(haystack)) add("warning", `${answer.questionLabel}: ${value}`);
    if (/stopp|lukt|avlopp/.test(haystack)) add("warning", `${answer.questionLabel}: ${value}`);
    if (/dåligt varmvatten|inget varmvatten|temperatur/.test(haystack)) add("warning", `${answer.questionLabel}: ${value}`);
    if (/lågt vattentryck|tryckproblem/.test(haystack)) add("warning", `${answer.questionLabel}: ${value}`);
    if (/missljud|larm|problem/.test(haystack)) add("warning", `${answer.questionLabel}: ${value}`);
    if (/titta|kontrollera|önskemål|extra/.test(haystack)) add("info", `${answer.questionLabel}: ${value}`);
  }

  return signals.slice(0, 8);
}

export function legacyCustomerGroupsFromMappedAnswers(answers: Record<string, unknown>): CustomerAnswerGroup[] {
  const rows = [
    ["Kunduppgifter", "customer_name", "Namn"],
    ["Kunduppgifter", "contact", "Kontakt"],
    ["Kunduppgifter", "property_address", "Adress"],
    ["Fastigheten", "build_year", "Byggår"],
    ["Fastigheten", "area_floors", "Boyta och våningar"],
    ["Värmesystem", "heat_source_type", "Värmekälla"],
    ["Värmesystem", "heat_source_product", "Värmekälla produkt"],
    ["Värmesystem", "service_history", "Servicehistorik"],
    ["Värmesystem", "alarms", "Larm eller fel"],
    ["Varmvatten", "hot_water_type", "Varmvatten"],
    ["Varmvatten", "hot_water_product", "Varmvatten produkt"],
    ["Värmedistribution", "radiator_package_notes", "Radiatorer"],
    ["Golvvärme", "floor_heating", "Golvvärme"],
    ["Kundens önskemål", "observations", "Kundens observationer"],
    ["Kundens önskemål", "other_information", "Övrig information"],
  ];
  const sections = Array.from(new Set(rows.map(([section]) => section)));
  return sections.map((section) => ({
    id: section.toLowerCase().replace(/\s+/g, "-"),
    title: section,
    items: rows
      .filter(([itemSection]) => itemSection === section)
      .map(([, key, label]) => ({
        key,
        label,
        value: formatCustomerAnswer(answers[key]),
        answered: answerHasValue(answers[key]),
        source: "derived" as const,
      })),
  }));
}
