export type ParsedReportData = {
  rawText: string;
  confidence: number;
  warnings: string[];
  fields: {
    customerName?: string;
    propertyName?: string;
    address?: string;
    buildYear?: number;
    heating?: string;
    health?: number;
    risk?: number;
    nextAction?: string;
    summary?: string;
  };
  components: Array<{
    typeName: string;
    systemName: string;
    category: string;
    brand?: string;
    model?: string;
    serialNo?: string;
    installedYear?: number;
    normalLifeYears?: number;
    status: "GREEN" | "YELLOW" | "ORANGE" | "RED" | "GREY";
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    condition?: string;
    replacementCostKr?: number;
  }>;
};

const fieldPatterns = {
  customerName: /(?:kund|beställare)\s*[:\-]\s*(.+)/i,
  propertyName: /(?:fastighet|objekt|anläggning)\s*[:\-]\s*(.+)/i,
  address: /(?:adress|besöksadress)\s*[:\-]\s*(.+)/i,
  buildYear: /(?:byggår|byggar)\s*[:\-]\s*(\d{4})/i,
  heating: /(?:värmekälla|varmekalla|uppvärmning)\s*[:\-]\s*(.+)/i,
  health: /(?:teknisk status|statuspoäng|husstatus)\s*[:\-]\s*(\d{1,3})/i,
  risk: /(?:riskindex|total risk|risk)\s*[:\-]\s*(\d{1,3})/i,
  nextAction: /(?:nästa åtgärd|rekommenderad åtgärd|prioriterad åtgärd)\s*[:\-]\s*(.+)/i,
  summary: /(?:sammanfattning|bedömning)\s*[:\-]\s*(.+)/i,
};

function clean(value?: string) {
  return value?.replace(/\s+/g, " ").trim();
}

function numberFrom(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function capScore(value?: number) {
  if (value === undefined) return undefined;
  return Math.max(0, Math.min(100, value));
}

function statusFromText(text: string): "GREEN" | "YELLOW" | "ORANGE" | "RED" | "GREY" {
  if (/hög|hog|akut|röd|rod|bör bytas|bor bytas/i.test(text)) return "RED";
  if (/medel|orange|åtgärd|atgard/i.test(text)) return "ORANGE";
  if (/gul|bevaka|kontroll/i.test(text)) return "YELLOW";
  if (/bra|ok|god|grön|gron/i.test(text)) return "GREEN";
  return "GREY";
}

function riskFromStatus(status: string): "LOW" | "MEDIUM" | "HIGH" {
  if (status === "RED") return "HIGH";
  if (status === "ORANGE" || status === "YELLOW") return "MEDIUM";
  return "LOW";
}

function parseComponents(lines: string[]) {
  const components: ParsedReportData["components"] = [];
  const knownTypes = [
    "värmepump",
    "varmepump",
    "cirkulationspump",
    "köldbärarpump",
    "koldbararpump",
    "expansionskärl",
    "expansionskarl",
    "blandningsventil",
    "säkerhetsventil",
    "sakerhetsventil",
    "vvb",
    "varmvattenberedare",
    "radiatorventil",
    "vattenmätare",
    "vattenmatare",
    "golvbrunn",
    "diskbänksskåp",
    "diskbanksskap",
    "wc-stol",
  ];

  for (const line of lines) {
    const normalized = line.toLowerCase();
    const type = knownTypes.find((item) => normalized.includes(item));
    if (!type) continue;

    const status = statusFromText(line);
    const installedYear = numberFrom(line.match(/\b(19\d{2}|20\d{2})\b/)?.[1]);
    const cost = numberFrom(line.match(/(\d[\d\s]{2,})\s*kr/i)?.[1]);

    components.push({
      typeName: clean(type.replace(/\b\w/g, (letter) => letter.toUpperCase())) ?? type,
      systemName: /vatten|disk|wc|golvbrunn|sanitet/i.test(line) ? "Tappvatten & sanitet" : "Värmesystem",
      category: /vatten|disk|wc|golvbrunn|sanitet/i.test(line) ? "Tappvatten" : "Värmesystem",
      brand: clean(line.match(/(?:fabrikat|märke|marke)\s*[:\-]\s*([^\|,;]+)/i)?.[1]),
      model: clean(line.match(/(?:modell)\s*[:\-]\s*([^\|,;]+)/i)?.[1]),
      serialNo: clean(line.match(/(?:serie|serienr|id)\s*[:\-]\s*([^\|,;]+)/i)?.[1]),
      installedYear,
      normalLifeYears: /expansion/i.test(line) ? 15 : 20,
      status,
      riskLevel: riskFromStatus(status),
      condition: clean(line.match(/(?:skick|status|observation)\s*[:\-]\s*([^\|,;]+)/i)?.[1]) ?? status,
      replacementCostKr: cost,
    });
  }

  return components.slice(0, 30);
}

export function parseReportText(rawText: string): ParsedReportData {
  const text = rawText.replace(/\r/g, "\n");
  const lines = text
    .split("\n")
    .map((line) => clean(line))
    .filter((line): line is string => Boolean(line));

  const fields: ParsedReportData["fields"] = {};
  for (const [key, pattern] of Object.entries(fieldPatterns)) {
    const match = text.match(pattern);
    const value = clean(match?.[1]);
    if (!value) continue;

    if (key === "buildYear" || key === "health" || key === "risk") {
      fields[key] = key === "health" || key === "risk" ? capScore(numberFrom(value)) : numberFrom(value);
    } else {
      fields[key as keyof typeof fields] = value as never;
    }
  }

  const components = parseComponents(lines);
  const warnings: string[] = [];
  if (rawText.trim().length < 80) warnings.push("PDF:en verkar sakna läsbar text. Den kan vara scannad och kräva OCR.");
  if (!components.length) warnings.push("Inga komponentrader hittades automatiskt. Kontrollera formulärets rubriker.");
  if (!fields.health && !fields.risk) warnings.push("Status/risk hittades inte tydligt i formuläret.");

  const hits = Object.values(fields).filter(Boolean).length + components.length;
  const confidence = Math.max(10, Math.min(95, 20 + hits * 10));

  return {
    rawText: rawText.slice(0, 8000),
    confidence,
    warnings,
    fields,
    components,
  };
}
