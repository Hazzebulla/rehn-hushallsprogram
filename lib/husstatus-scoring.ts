export type ScoringRiskLevel = "Låg" | "Medel" | "Hög" | "Kritisk";
export type ActionNeed =
  | "Ingen åtgärd"
  | "Bevaka"
  | "Kontroll rekommenderas"
  | "Planera underhåll"
  | "Planera byte"
  | "Åtgärda"
  | "Akut åtgärd";

export type ScoringComponentInput = {
  typeName?: string;
  category?: string;
  systemName?: string;
  brand?: string | null;
  model?: string | null;
  serialNo?: string | null;
  estimatedYear?: number | null;
  installedYear?: string | number | null;
  plannedReplacementYear?: number | null;
  replacementCostCents?: number | null;
  status?: string | null;
  riskLevel?: string | null;
  condition?: string | null;
  displayStatus?: string | null;
  replacementLabel?: string | null;
  type?: { name?: string; category?: string; normalLifeYears?: number | null } | null;
  system?: { name?: string; category?: string } | null;
};

export type ComponentAssessment = {
  id: string;
  component: string;
  category: string;
  conditionScore: number;
  riskScore: number;
  riskLevel: ScoringRiskLevel;
  actionNeed: ActionNeed;
  recommendedTime: string;
  forecastPeriod: string;
  forecastConfidence: "Hög" | "Medel" | "Låg";
  currentAction: boolean;
  costCents: number;
  reasonsPositive: string[];
  reasonsNegative: string[];
  explanation: string;
};

export type ScoringAction = {
  component: string;
  action: string;
  reason: string;
  priority: ScoringRiskLevel;
  recommendedTime: string;
  costCents: number;
  status: "Bevaka" | "Rekommenderas" | "Akut" | "Plan";
};

export type CategoryScore = {
  label: string;
  score: number;
  riskIndex: number;
  riskLevel: ScoringRiskLevel;
  count: number;
};

export type RiskMatrixPoint = {
  component: string;
  probability: number;
  consequence: number;
  riskLevel: ScoringRiskLevel;
  reason: string;
};

export type HusstatusScoringResult = {
  scoringVersion: 2;
  houseScore: number;
  riskIndex: number;
  riskLevel: ScoringRiskLevel;
  controlGrade: number;
  dataSufficient: boolean;
  summary: string;
  counts: {
    urgent: number;
    recommended: number;
    watch: number;
    passed: number;
    unchecked: number;
  };
  categoryScores: CategoryScore[];
  componentAssessments: ComponentAssessment[];
  actions: ScoringAction[];
  riskMatrix: RiskMatrixPoint[];
};

type AnswerRecord = Record<string, unknown> | Map<string, unknown>;

const categoryWeights: Record<string, number> = {
  Tappvatten: 1.25,
  Vattensäkerhet: 1.25,
  Värmesystem: 1.2,
  Cirkulationspump: 1.05,
  Varmvatten: 1.15,
  Säkerhetsfunktioner: 1.3,
  Avlopp: 1.1,
  Sanitet: 0.85,
  "El & styr": 0.95,
  Övrigt: 0.8,
};

const defaultLifeYears: Record<string, number> = {
  värmepump: 18,
  cirkulationspump: 15,
  köldbärarpump: 15,
  blandningsventil: 18,
  säkerhetsventil: 12,
  expansionskärl: 15,
  varmvattenberedare: 18,
  blandare: 20,
  golvbrunn: 30,
  smutsfilter: 25,
};

const currentFaultPatterns = [
  /akut/i,
  /läck|lack/i,
  /vattenskada/i,
  /tryckfall/i,
  /ej funger/i,
  /trasig/i,
  /otät|otat/i,
  /korrosion|rost/i,
  /säkerhetsventil.*(fungerar inte|ej)/i,
];

function asEntries(answers: AnswerRecord) {
  return answers instanceof Map ? Array.from(answers.entries()) : Object.entries(answers);
}

function answerText(value: unknown): string {
  if (Array.isArray(value)) return value.map(answerText).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return String(value ?? "");
  const record = value as Record<string, unknown>;
  if ("value" in record || "values" in record) return answerText(record.value ?? record.values);
  if ("dataUrl" in record || "imageDataUrl" in record) return "";
  return Object.values(record).map(answerText).filter(Boolean).join(" ");
}

function normalized(value: unknown) {
  return answerText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function riskLevel(score: number): ScoringRiskLevel {
  if (score >= 78) return "Kritisk";
  if (score >= 58) return "Hög";
  if (score >= 34) return "Medel";
  return "Låg";
}

function statusText(component: ScoringComponentInput) {
  return normalized(`${component.displayStatus ?? ""} ${component.status ?? ""} ${component.condition ?? ""} ${component.riskLevel ?? ""}`);
}

function componentName(component: ScoringComponentInput) {
  return String(component.typeName ?? component.type?.name ?? component.category ?? "Komponent").trim() || "Komponent";
}

function componentCategory(component: ScoringComponentInput) {
  return String(component.category ?? component.type?.category ?? component.system?.category ?? "Övrigt").trim() || "Övrigt";
}

function componentYear(component: ScoringComponentInput) {
  const raw = component.estimatedYear ?? component.installedYear;
  const year = Number(String(raw ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(year) && year >= 1900 ? year : undefined;
}

function normalLife(component: ScoringComponentInput) {
  const name = normalized(componentName(component));
  const configured = Number(component.type?.normalLifeYears);
  if (Number.isFinite(configured) && configured > 0) return configured;
  const match = Object.entries(defaultLifeYears).find(([key]) => name.includes(key));
  return match?.[1] ?? 20;
}

function hasCurrentFault(text: string) {
  return currentFaultPatterns.some((pattern) => pattern.test(text));
}

function assessComponent(component: ScoringComponentInput, index: number, currentYear: number): ComponentAssessment {
  const name = componentName(component);
  const category = componentCategory(component);
  const text = statusText(component);
  const year = componentYear(component);
  const age = year ? Math.max(0, currentYear - year) : undefined;
  const life = normalLife(component);
  const ageRatio = age === undefined ? undefined : age / life;
  const positives: string[] = [];
  const negatives: string[] = [];

  let condition = 78;
  if (/god|bra|ok|fungerar|kontrollerat|green|low/.test(text)) {
    condition = 90;
    positives.push("Funktion eller skick är registrerat som godkänt.");
  }
  if (/medel|normal|bevaka|yellow|orange/.test(text)) {
    condition = 74;
    negatives.push("Komponenten är markerad för uppföljning.");
  }
  if (/kontrollera|avvikelse|brist|rekommenderas|unknown|grey/.test(text)) {
    condition = 62;
    negatives.push("Det finns avvikelse eller osäker kontrollpunkt.");
  }
  if (hasCurrentFault(text) || /red|high|critical|hög|kritisk/.test(text)) {
    condition = 38;
    negatives.push("Faktisk brist eller tydlig risk är noterad.");
  }

  if (age !== undefined) {
    positives.push(`Installationsår ${year} är registrerat.`);
    if (ageRatio !== undefined && ageRatio > 1.15 && condition >= 82) {
      condition -= 8;
      negatives.push(`Komponenten är äldre än normal teknisk livslängd (${age} år).`);
    } else if (ageRatio !== undefined && ageRatio > 0.8) {
      if (condition >= 82) condition -= 4;
      negatives.push(`Komponenten närmar sig normal teknisk livslängd (${age} år).`);
    }
  } else {
    negatives.push("Ålder saknas och prognosen blir osäkrare.");
  }

  const categoryWeight = categoryWeights[category] ?? categoryWeights.Övrigt;
  const consequenceBase = /säker|expansion|vatten|tapp|varmvatten|avlopp|värme|pump/i.test(`${name} ${category}`) ? 52 : 38;
  let probability = 18;
  if (/god|bra|ok|fungerar/.test(text)) probability -= 5;
  if (/kontrollera|avvikelse|brist|rekommenderas|medel/.test(text)) probability += 18;
  if (hasCurrentFault(text)) probability += 42;
  if (ageRatio !== undefined && ageRatio > 1.15) probability += 14;
  else if (ageRatio !== undefined && ageRatio > 0.8) probability += 8;
  if (age === undefined) probability += 6;

  const consequence = clamp(consequenceBase * categoryWeight, 10, 95);
  const riskScore = clamp((probability * 0.58) + (consequence * 0.42), 3, 96);
  const level = riskLevel(riskScore);
  const score = clamp(condition, 10, 98);

  let actionNeed: ActionNeed = "Ingen åtgärd";
  let recommendedTime = "Ingen åtgärd";
  let currentAction = false;
  if (level === "Kritisk" || /akut/.test(text)) {
    actionNeed = "Akut åtgärd";
    recommendedTime = "Omgående";
    currentAction = true;
  } else if (level === "Hög" && hasCurrentFault(text)) {
    actionNeed = "Åtgärda";
    recommendedTime = "Snarast";
    currentAction = true;
  } else if (level === "Hög") {
    actionNeed = "Kontroll rekommenderas";
    recommendedTime = "Inom 3 månader";
  } else if (level === "Medel" && ageRatio !== undefined && ageRatio > 0.8) {
    actionNeed = "Bevaka";
    recommendedTime = "Inom 12 månader";
  } else if (level === "Medel") {
    actionNeed = "Kontroll rekommenderas";
    recommendedTime = "Inom 12 månader";
  }

  const replacementYear = Number(component.plannedReplacementYear);
  const forecastStart = Number.isFinite(replacementYear) && replacementYear > currentYear
    ? replacementYear
    : year ? year + life : currentYear + 5;
  const interval = actionNeed === "Akut åtgärd" || actionNeed === "Åtgärda"
    ? "0-1 år"
    : forecastStart <= currentYear + 3
      ? `${Math.max(currentYear, forecastStart)}-${Math.max(currentYear, forecastStart) + 2}`
      : `${forecastStart}-${forecastStart + 4}`;
  const forecastConfidence = year && component.model ? "Medel" : year ? "Låg" : "Låg";

  if (!positives.length) positives.push("Ingen akut brist är registrerad.");

  return {
    id: `${index}-${name}-${component.brand ?? ""}-${component.model ?? ""}`,
    component: name,
    category,
    conditionScore: score,
    riskScore,
    riskLevel: level,
    actionNeed,
    recommendedTime,
    forecastPeriod: interval,
    forecastConfidence,
    currentAction,
    costCents: Number(component.replacementCostCents ?? 0) || 0,
    reasonsPositive: positives,
    reasonsNegative: negatives,
    explanation: `${name}: skick ${score}/100, risk ${level}.`,
  };
}

function answerSignals(answers: AnswerRecord) {
  const entries = asEntries(answers);
  let answered = 0;
  let unchecked = 0;
  let negativeSignals = 0;
  let seriousSignals = 0;
  let positiveSignals = 0;

  for (const [key, value] of entries) {
    if (key.endsWith("__photos") || key.endsWith("__source") || key === "section_statuses" || key === "signatures") continue;
    const text = normalized(value);
    if (!text.trim()) continue;
    answered += 1;
    if (/ej kontrollerat|ej atkomligt|okant|vet inte|uppgift saknas/.test(text)) unchecked += 1;
    if (/akut|lackage|vattenskada|tryckfall|ej funger|trasig|otat/.test(text)) seriousSignals += 1;
    if (/avvikelse|brist|rekommenderas|bor bytas|hog|medel/.test(text)) negativeSignals += 1;
    if (/god|bra|ok|finns|kontrollerat|nej/.test(text)) positiveSignals += 1;
  }

  return { answered, unchecked, negativeSignals, seriousSignals, positiveSignals };
}

function uniqueActions(assessments: ComponentAssessment[]): ScoringAction[] {
  const seen = new Set<string>();
  return assessments
    .filter((item) => item.actionNeed !== "Ingen åtgärd")
    .sort((a, b) => b.riskScore - a.riskScore)
    .map((item) => {
      const status: ScoringAction["status"] = item.actionNeed === "Akut åtgärd"
        ? "Akut"
        : item.currentAction ? "Rekommenderas" : item.actionNeed === "Bevaka" ? "Bevaka" : "Plan";
      return {
        component: item.component,
        action: item.actionNeed === "Bevaka"
          ? `Rekommenderad ny bedömning av ${item.component.toLowerCase()}`
          : item.actionNeed === "Kontroll rekommenderas"
            ? `Kontrollera ${item.component.toLowerCase()}`
            : item.actionNeed,
        reason: item.reasonsNegative[0] ?? "Bedömningen kräver uppföljning.",
        priority: item.riskLevel,
        recommendedTime: item.recommendedTime,
        costCents: item.currentAction ? item.costCents : 0,
        status,
      };
    })
    .filter((action) => {
      const key = `${action.component}-${action.action}-${action.recommendedTime}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function categoryScores(assessments: ComponentAssessment[]): CategoryScore[] {
  const grouped = new Map<string, ComponentAssessment[]>();
  for (const item of assessments) {
    grouped.set(item.category, [...(grouped.get(item.category) ?? []), item]);
  }

  return Array.from(grouped.entries())
    .map(([label, items]) => {
      const score = clamp(items.reduce((sum, item) => sum + item.conditionScore, 0) / items.length);
      const risk = clamp(items.reduce((sum, item) => sum + item.riskScore, 0) / items.length);
      return { label, score, riskIndex: risk, riskLevel: riskLevel(risk), count: items.length };
    })
    .sort((a, b) => b.riskIndex - a.riskIndex);
}

export function calculateHusstatusScore(
  answers: AnswerRecord,
  components: ScoringComponentInput[] = [],
  options: { currentYear?: number; totalControlPoints?: number } = {},
): HusstatusScoringResult {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const assessments = components.map((component, index) => assessComponent(component, index, currentYear));
  const signals = answerSignals(answers);
  const totalControlPoints = Math.max(options.totalControlPoints ?? 0, signals.answered, 1);
  const controlGrade = clamp(((signals.answered - signals.unchecked * 0.65) / totalControlPoints) * 100);
  const dataSufficient = signals.answered >= Math.max(6, Math.round(totalControlPoints * 0.1)) || assessments.length >= 2;

  const weightedCondition = assessments.length
    ? assessments.reduce((sum, item) => sum + item.conditionScore * (categoryWeights[item.category] ?? categoryWeights.Övrigt), 0)
      / assessments.reduce((sum, item) => sum + (categoryWeights[item.category] ?? categoryWeights.Övrigt), 0)
    : 78;
  const observationPenalty = signals.seriousSignals * 7 + signals.negativeSignals * 2 - signals.positiveSignals * 0.35;
  const houseScore = dataSufficient
    ? clamp(weightedCondition - observationPenalty - Math.max(0, 70 - controlGrade) * 0.08, 18, 97)
    : 0;

  const componentRisk = assessments.length
    ? assessments.reduce((sum, item) => sum + item.riskScore * (categoryWeights[item.category] ?? categoryWeights.Övrigt), 0)
      / assessments.reduce((sum, item) => sum + (categoryWeights[item.category] ?? categoryWeights.Övrigt), 0)
    : 18;
  const answerRisk = signals.seriousSignals * 13 + signals.negativeSignals * 4 + signals.unchecked * 1.5;
  const riskIndex = dataSufficient ? clamp(componentRisk * 0.68 + answerRisk * 0.32, 3, 96) : 0;
  const actions = uniqueActions(assessments);
  const passed = assessments.filter((item) => item.riskLevel === "Låg" && item.conditionScore >= 80).length;
  const urgent = actions.filter((item) => item.status === "Akut").length;
  const recommended = actions.filter((item) => item.status === "Rekommenderas" || item.priority === "Hög").length;
  const watch = actions.filter((item) => item.status === "Bevaka" || item.status === "Plan").length;
  const cats = categoryScores(assessments);

  return {
    scoringVersion: 2,
    houseScore,
    riskIndex,
    riskLevel: riskLevel(riskIndex),
    controlGrade,
    dataSufficient,
    summary: dataSufficient
      ? `Bedömningen baseras på ${controlGrade}% kontrollgrad. ${urgent} akuta brister, ${recommended} rekommenderade åtgärder och ${watch} bevakningspunkter.`
      : "Underlaget är för begränsat för en säker scoring. Fyll i fler kontroller och komponenter.",
    counts: {
      urgent,
      recommended,
      watch,
      passed,
      unchecked: signals.unchecked,
    },
    categoryScores: cats,
    componentAssessments: assessments,
    actions,
    riskMatrix: assessments.map((item) => ({
      component: item.component,
      probability: clamp(item.riskScore * 0.72),
      consequence: clamp(item.riskScore * 0.88),
      riskLevel: item.riskLevel,
      reason: item.reasonsNegative[0] ?? item.reasonsPositive[0] ?? "Komponentbedömning",
    })),
  };
}
