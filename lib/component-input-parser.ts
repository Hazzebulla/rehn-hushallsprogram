export type ComponentProductOption = {
  id: string;
  category: string;
  manufacturer: string;
  rskNumber?: string | null;
  productName?: string | null;
  modelName?: string | null;
  systemType?: string | null;
  technicalData?: string | null;
};

export type ParsedComponentInputRow = {
  productModelId?: string;
  typeName: string;
  systemName: string;
  category: string;
  brand: string;
  model: string;
  serialNo: string;
  installedYear: string;
  status: string;
  replacementYear: string;
  replacementPeriod: string;
  costKr: string;
  location: string;
  comment: string;
  confidence?: Record<string, number>;
  warnings?: string[];
  approved?: boolean;
};

type ComponentRule = {
  typeName: string;
  category: string;
  brand?: string;
  pattern: RegExp;
  modelPattern?: RegExp;
};

const componentRules: ComponentRule[] = [
  { typeName: "Luft-luftvärmepump", category: "Värmesystem", brand: "Panasonic", pattern: /\bpanasonic\b.*\bcu[-\s]?[a-z0-9]+[-\s]?[a-z0-9]+\b/i, modelPattern: /\b(cu[-\s]?[a-z0-9]+[-\s]?[a-z0-9]+)\b/i },
  { typeName: "Luft-luftvärmepump", category: "Värmesystem", pattern: /\b(?:llvp|ac[-\s]?värmepump|luft[-\s/]*luft(?:[-\s]*värmepump|[-\s]*pump)?|luftvärmepump)\b/i, modelPattern: /\b(cu[-\s]?[a-z0-9]+[-\s]?[a-z0-9]+)\b/i },
  { typeName: "Cirkulationspump", category: "Cirkulationspump", pattern: /\b(?:cirk\.?\s*pump|cirkulations\s*pump|cirkulationspump|värmepump för cirkulation)\b/i },
  { typeName: "WC-stol", category: "Sanitet", pattern: /\b(?:wc[-\s]?stol|toalett|toa|wc)\b/i },
  { typeName: "Duschblandare", category: "Tappvatten", pattern: /\b(?:duschblandare|termostatblandare\s+dusch|dusch\s+termostatblandare)\b/i },
  { typeName: "Köksblandare", category: "Tappvatten", pattern: /\b(?:kökskran|kokskran|köksblandare|koksblandare|blandare\s+kök|blandare\s+kok)\b/i },
  { typeName: "Tvättställsblandare", category: "Tappvatten", brand: "Mora", pattern: /\bmora\b.*\btvättställsblandare\b/i },
  { typeName: "Värmepanna", category: "Värmesystem", brand: "CTC", pattern: /\bctc\b.*\b(?:värmepanna|elpanna|panna)\b/i, modelPattern: /\bctc\s+(.+?)\s+(?:värmepanna|elpanna|panna)\b/i },
  { typeName: "Diskmaskin", category: "Kök", brand: "Bosch", pattern: /\bbosch\b.*\bdiskmaskin\b/i, modelPattern: /\bbosch\s+(.+?)\s+diskmaskin\b/i },
  { typeName: "Varmvattenberedare", category: "Varmvatten", brand: "NIBE", pattern: /\bnibe\b.*\b(?:varmvattenberedare|vvb)\b/i },
  { typeName: "Värmepump", category: "Värmesystem", brand: "NIBE", pattern: /\bnibe\b.*\bf\d{3,5}-?\d*\b/i, modelPattern: /\b(f\d{3,5}-?\d*)\b/i },
  { typeName: "Värmepump", category: "Värmesystem", brand: "NIBE", pattern: /\bnibe\b.*\bvärmepump\b/i },
  { typeName: "Värmepump", category: "Värmesystem", brand: "CTC", pattern: /\bctc\b.*\bgsi\s?\d+\b/i, modelPattern: /\b(gsi\s?\d+)\b/i },
  { typeName: "Varmvattenberedare", category: "Varmvatten", brand: "NIBE", pattern: /\bnibe\b.*\b(compact|vpb|vvm)\b/i, modelPattern: /\b(compact\s?\d*|vpb\s?\d+|vvm\s?\d+)\b/i },
  { typeName: "Blandningsventil", category: "Tappvatten", brand: "ESBE", pattern: /\besbe\b|\bvta\d+\b/i, modelPattern: /\b(vta\d+[a-z0-9 -]*)\b/i },
  { typeName: "Säkerhetsventil", category: "Värmesystem", brand: "Flamco", pattern: /\bflamco\b|\bprescor\b/i, modelPattern: /\b(prescor\s?[a-z0-9 -]*)\b/i },
  { typeName: "Cirkulationspump", category: "Cirkulationspump", brand: "Grundfos", pattern: /\bgrundfos\b|\balpha\s?2\b|\bupm\s?3\b/i, modelPattern: /\b(alpha\s?2\s?\d{2}-\d{2}|upm\s?3\s?\d{2}-\d{2})\b/i },
  { typeName: "Cirkulationspump", category: "Cirkulationspump", brand: "Wilo", pattern: /\bwilo\b|\byonos\b|\bstratos\b|\bstar[-\s]?rs\b/i, modelPattern: /\b(yonos\s?[a-z0-9 /-]*|stratos\s?[a-z0-9 /-]*|star[-\s]?rs\s?\d{1,2}\/\d{1,2})\b/i },
  { typeName: "Expansionskärl", category: "Värmesystem", brand: "Altech", pattern: /\baltech\b.*\bn\s?\d+\b/i, modelPattern: /\b(n\s?\d+)\b/i },
  { typeName: "Expansionskärl", category: "Värmesystem", brand: "Reflex", pattern: /\breflex\b.*\bn\s?\d+\b/i, modelPattern: /\b(n\s?\d+)\b/i },
  { typeName: "Golvbrunn", category: "Avlopp", brand: "Purus", pattern: /\bpurus\b|\boden\s?\d*\b/i, modelPattern: /\b(oden\s?\d*)\b/i },
  { typeName: "Blandare", category: "Tappvatten", brand: "FM Mattsson", pattern: /\bfm\s?matt?sson\b|\b9000\s?xe\b/i, modelPattern: /\b(9000\s?xe)\b/i },
  { typeName: "Blandare", category: "Tappvatten", brand: "Mora", pattern: /\bmora\b.*\bcera\b/i, modelPattern: /\b(cera\s?[a-z0-9 -]*)\b/i },
  { typeName: "WC-stol", category: "Sanitet", brand: "Ifö", pattern: /\bif[oö]\b|\bwc\b/i, modelPattern: /\b(sign\s?\d+)\b/i },
];

const knownBrands = [
  ["fm mattsson", "FM Mattsson"],
  ["fmm", "FM Mattsson"],
  ["nibe", "NIBE"],
  ["ctc", "CTC"],
  ["wilo", "Wilo"],
  ["panasonic", "Panasonic"],
  ["bosch", "Bosch"],
  ["gustavsberg", "Gustavsberg"],
  ["mora", "Mora"],
  ["grundfos", "Grundfos"],
  ["esbe", "ESBE"],
  ["altech", "Altech"],
  ["reflex", "Reflex"],
] as const;

const knownLocations = [
  "pannrum",
  "teknikrum",
  "undercentral",
  "kök",
  "badrum",
  "wc",
  "tvättstuga",
  "garage",
  "källare",
  "förråd",
  "bostad",
  "vardagsrum",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bmattson\b/g, "mattsson")
    .replace(/[^a-z0-9åäö]+/g, "");
}

function tidy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  const cleaned = tidy(value);
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function normalizeModel(value: string) {
  const cleaned = tidy(value)
    .replace(/\bok[aä]nd(?: modell)?\b/gi, "")
    .replace(/\bok[aä]nt(?: modell)?\b/gi, "")
    .replace(/\bmodell ok[aä]nd\b/gi, "")
    .replace(/\bmodell ok[aä]nt\b/gi, "")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\s+([/-])\s+/g, "$1")
    .trim();
  if (!cleaned) return "";
  const panasonicOutdoorUnit = cleaned.match(/^CU\s+([A-Z0-9]+)\s+([A-Z0-9]+)$/i);
  if (panasonicOutdoorUnit) return `CU-${panasonicOutdoorUnit[1]?.toUpperCase()}-${panasonicOutdoorUnit[2]?.toUpperCase()}`;
  return cleaned
    .replace(/\b(f|gsi|vta|alpha|upm|star|rs|cu|ne|ep|n)\s+/gi, (match) => match.toUpperCase())
    .replace(/\b(alpha2|upm3)\b/gi, (match) => match.toUpperCase())
    .replace(/\bstar-rs\b/gi, "Star-RS")
    .replace(/\s?XE$/i, " XE")
    .trim();
}

function splitLines(rawText: string) {
  return rawText
    .split(/\r?\n|(?<=\.)\s+(?=[A-ZÅÄÖ0-9])/)
    .map((line) => line.trim().replace(/\.$/, ""))
    .filter(Boolean)
    .filter((line) => {
      const normalized = normalize(line);
      return !normalized.includes("installationsregister") && normalized !== "komponent" && !normalized.startsWith("komponentfabrikat");
    });
}

function expandQuantity(line: string) {
  const match = line.match(/^\s*(\d{1,2})\s*(?:st|stycken|x)\s+(.+)$/i);
  if (!match) return [line];
  const count = Math.min(Number(match[1]), 12);
  if (!Number.isFinite(count) || count < 2) return [line];
  return Array.from({ length: count }, () => match[2] ?? line);
}

function tableColumns(line: string) {
  if (line.includes("|")) return line.split("|").map(tidy);
  if (line.includes("\t")) return line.split(/\t+/).map(tidy);
  if (line.includes(";")) return line.split(";").map(tidy);
  return line.split(/\s{2,}/).map(tidy);
}

function splitBrandModel(value: string) {
  const cleaned = tidy(value);
  const matchedRule = componentRules.find((rule) => rule.brand && normalize(cleaned).startsWith(normalize(rule.brand)));
  if (matchedRule?.brand) {
    return {
      brand: matchedRule.brand,
      model: tidy(cleaned.slice(matchedRule.brand.length)),
    };
  }
  const [brand = "", ...modelParts] = cleaned.split(/\s+/);
  return { brand, model: modelParts.join(" ") };
}

function extractYear(line: string) {
  if (/\b(?:år|från|installerad|installation|årsmodell)?\s*ok[aä]nt\b/i.test(line)) {
    return { value: "", uncertain: false };
  }
  const match = line.match(/\b(?:år|från|installerad|installation)?\s*((?:19|20)\d{2})\b/i);
  const uncertain = /\b(ca|cirka|ungefär|ungefärligt)\b/i.test(line);
  return { value: match?.[1] ?? "", uncertain };
}

function extractSerial(line: string) {
  const labelled = line.match(/\b(?:serienr|serienummer|serie[-\s]?id|serial|s\/n|sn)\s*[:#-]?\s*([a-zåäö0-9][a-zåäö0-9 -]{3,45})/i);
  if (!labelled?.[1]) return "";
  return tidy(labelled[1].replace(/\b(?:år|från|installerad|installation)\b.*$/i, "").replace(/[,.;].*$/, ""));
}

function extractSystem(line: string) {
  const values = [
    ...line.matchAll(/\bDN\s?\d+\b/gi),
    ...line.matchAll(/\b\d+(?:[,.]\d+)?\s?(?:mm|l|liter|kw|bar)\b/gi),
  ].map((match) => match[0].replace(/\s+/g, " ").replace(/liter/i, "l"));
  return Array.from(new Set(values)).join(" / ");
}

function extractCondition(line: string) {
  const explicit = line.match(/\bskick\s+([a-zåäö -]+)/i)?.[1] ?? line;
  if (/(dåligt|daligt|defekt|trasig|trasigt|läcker|lacker)/i.test(explicit)) return "Dåligt";
  if (/(slitet|gammalt|åldrat|aldrat|äldre|aldre)/i.test(explicit)) return "Åldrat";
  if (/(bra|fint|god|ok|fungerar|fungerande)/i.test(explicit)) return "God";
  return "Ej valt";
}

function extractLocation(line: string) {
  const explicit = line.match(/\bplacering\s+([a-zåäö -]+?)(?:[,.;]|$)/i)?.[1]
    ?? line.match(/\bi\s+([a-zåäö -]+?)(?:[,.;]|$)/i)?.[1]
    ?? "";
  const source = explicit || line;
  const normalized = source.toLowerCase();
  const location = knownLocations.find((item) => normalized.includes(item));
  if (!location) return "";
  if (location === "wc") return "WC";
  if (location === "vardagsrum") return "Vardagsrum";
  return titleCase(location);
}

function matchRule(line: string) {
  const matches = componentRules.filter((rule) => rule.pattern.test(line));
  return matches.find((rule) => rule.brand && new RegExp(`\\b${rule.brand.replace(/\s+/g, "\\s?")}\\b`, "i").test(line))
    ?? matches.find((rule) => rule.modelPattern)
    ?? matches[0];
}

function extractBrand(line: string, rule?: ComponentRule) {
  if (rule?.brand && new RegExp(`\\b${rule.brand.replace(/\s+/g, "\\s?")}\\b`, "i").test(line)) {
    return rule.brand;
  }
  const normalizedLine = normalize(line);
  const brand = knownBrands.find(([alias]) => normalizedLine.includes(normalize(alias)));
  return brand?.[1] ?? rule?.brand ?? "";
}

function withoutParsedMetadata(line: string) {
  return tidy(line)
    .replace(/\blägg till\b/gi, "")
    .replace(/\b(?:en|ett)\b/gi, " ")
    .replace(/\bmodell ok[aä]nd\b/gi, "")
    .replace(/\bmodell ok[aä]nt\b/gi, "")
    .replace(/\b(?:år|från|installerad|installation|årsmodell)\s*(?:ok[aä]nt|(?:19|20)\d{2})\b/gi, "")
    .replace(/\b(?:19|20)\d{2}\b/g, "")
    .replace(/\b(?:llvp|ac[-\s]?värmepump|luft[-\s/]*luft(?:[-\s]*värmepump|[-\s]*pump)?|luftvärmepump|cirk\.?\s*pump|cirkulations\s*pump|cirkulationspump|värmepump för cirkulation|wc[-\s]?stol|toalett|toa|wc|duschblandare|termostatblandare\s+dusch|dusch\s+termostatblandare|kökskran|kokskran|köksblandare|koksblandare|blandare\s+kök|blandare\s+kok|tvättställsblandare|varmvattenberedare|vvb|värmepanna|elpanna|panna|diskmaskin)\b/gi, " ")
    .replace(/\bskick\s+(?:god|bra|ok|fint|fungerar|fungerande|åldrat|aldrat|gammalt|slitet|dåligt|daligt|defekt|trasigt|trasig)\b/gi, "")
    .replace(/\bplacering\s+[a-zåäö -]+(?:[,.;]|$)/gi, "")
    .replace(/\bi\s+(?:pannrummet|pannrum|teknikrummet|teknikrum|köket|kök|badrummet|badrum|wc|tvättstugan|tvättstuga|garaget|garage|källaren|källare|förrådet|förråd|bostaden|bostad|vardagsrummet|vardagsrum)\b/gi, "")
    .replace(/\b(?:pannrummet|pannrum|teknikrummet|teknikrum|köket|kök|badrummet|badrum|wc|tvättstugan|tvättstuga|garaget|garage|källaren|källare|förrådet|förråd|bostaden|bostad|vardagsrummet|vardagsrum)\b/gi, "")
    .replace(/\b(god|bra|ok|fint|fungerar|fungerande|åldrat|aldrat|gammalt|slitet|dåligt|daligt|defekt|trasigt|trasig)\b/gi, "")
    .replace(/[,.]+/g, " ");
}

function extractModel(line: string, rule?: ComponentRule) {
  if (/\bmodell ok[aä]nd\b/i.test(line)) return "";
  const explicit = line.match(/\bmodell\s+(.+?)(?:\bfrån\b|\bår\b|\bskick\b|\bplacering\b|\bi\s+(?:pannrum|pannrummet|kök|köket|badrum|badrummet|wc|bostad|bostaden|vardagsrum|vardagsrummet)|[,.;]|$)/i);
  if (explicit?.[1]) return normalizeModel(explicit[1]);
  const patternMatch = rule?.modelPattern ? line.match(rule.modelPattern) : null;
  if (patternMatch?.[1]) return normalizeModel(patternMatch[1]);

  const brand = extractBrand(line, rule);
  if (!brand || !rule) return "";
  let candidate = withoutParsedMetadata(line);
  for (const [alias, canonical] of knownBrands) {
    if (canonical === brand) candidate = candidate.replace(new RegExp(`\\b${alias.replace(/\s+/g, "\\s+")}\\b`, "i"), " ");
  }
  candidate = candidate.replace(rule.pattern, " ");
  return normalizeModel(candidate);
}

function matchProduct(row: ParsedComponentInputRow, products: ComponentProductOption[]) {
  const wanted = normalize(`${row.brand} ${row.model}`);
  if (!wanted || wanted.length < 4) return undefined;

  return products.find((product) => {
    const productText = normalize(`${product.manufacturer} ${product.productName ?? ""} ${product.modelName ?? ""}`);
    return productText.includes(wanted) || wanted.includes(productText);
  }) ?? products.find((product) => {
    const model = normalize(row.model);
    const productText = normalize(`${product.productName ?? ""} ${product.modelName ?? ""}`);
    return model.length >= 5 && productText.includes(model);
  });
}

function parseTableRow(line: string, products: ComponentProductOption[]): ParsedComponentInputRow | null {
  const columns = tableColumns(line);
  if (line.includes("|") && columns.length >= 6) {
    const [typeName = "", brand = "", model = "", installedYear = "", status = "", location = ""] = columns;
    const row: ParsedComponentInputRow = {
      typeName: matchRule(typeName)?.typeName ?? titleCase(typeName),
      systemName: "",
      category: matchRule(typeName)?.category ?? (typeName || "Övrigt"),
      brand: extractBrand(brand) || titleCase(brand),
      model: normalizeModel(model),
      serialNo: "",
      installedYear: /^(?:19|20)\d{2}$/.test(installedYear) ? installedYear : "",
      status: extractCondition(status),
      replacementYear: "",
      replacementPeriod: "",
      costKr: "",
      location: extractLocation(location) || titleCase(location),
      comment: "",
      confidence: { table: 0.98 },
      warnings: [],
      approved: true,
    };
    const product = matchProduct(row, products);
    if (product) {
      row.productModelId = product.id;
      row.category = product.category || row.category;
    }
    return row;
  }
  if (columns.length < 5 || !/^(?:19|20)\d{2}$/.test(columns[4] ?? "")) return null;
  const [typeName = "", brandModel = "", systemName = "", serialNo = "", installedYear = "", status = ""] = columns;
  const { brand, model } = splitBrandModel(brandModel);
  const row: ParsedComponentInputRow = {
    typeName,
    systemName,
    category: typeName || "Övrigt",
    brand,
    model,
    serialNo,
    installedYear,
    status,
    replacementYear: "",
    replacementPeriod: "",
    costKr: "",
    location: "",
    comment: "",
    confidence: { table: 0.98 },
    warnings: [],
    approved: true,
  };
  const product = matchProduct(row, products);
  if (product) {
    row.productModelId = product.id;
    row.category = product.category || row.category;
  }
  return row;
}

function parseFreeTextRow(line: string, products: ComponentProductOption[]): ParsedComponentInputRow {
  const rule = matchRule(line);
  const year = extractYear(line);
  const systemName = extractSystem(line);
  const serialNo = extractSerial(line);
  const model = extractModel(line, rule);
  const brand = extractBrand(line, rule);
  const warnings: string[] = [];
  const confidence: Record<string, number> = {};

  if (year.uncertain && year.value) {
    warnings.push("Årtal är tolkat som ungefärligt och bör kontrolleras.");
    confidence.installedYear = 0.65;
  } else if (year.value) {
    confidence.installedYear = 0.98;
  } else if (rule) {
    warnings.push("Årtal saknas och lämnas tomt.");
  }
  if (!model && brand && !/\bmodell ok[aä]nd\b/i.test(line)) warnings.push("Modell saknas eller kunde inte tolkas säkert.");
  if (!serialNo && /\bserie|serienr|serienummer|serial|sn\b/i.test(line)) warnings.push("Serienummer nämns men kunde inte tolkas säkert.");

  const row: ParsedComponentInputRow = {
    typeName: rule?.typeName ?? "Kontrollera",
    systemName,
    category: rule?.category ?? "Övrigt",
    brand,
    model,
    serialNo,
    installedYear: year.value,
    status: extractCondition(line),
    replacementYear: "",
    replacementPeriod: "",
    costKr: "",
    location: extractLocation(line),
    comment: "",
    confidence,
    warnings,
    approved: true,
  };

  const product = matchProduct(row, products);
  if (product) {
    row.productModelId = product.id;
    row.category = product.category || row.category;
    row.brand = row.brand || product.manufacturer;
    row.model = row.model || product.productName || product.modelName || "";
    confidence.productModelId = 0.9;
  }

  return row;
}

export function parseComponentInput(rawText: string, products: ComponentProductOption[] = []): ParsedComponentInputRow[] {
  const lines = splitLines(rawText).flatMap(expandQuantity);
  return lines
    .map((line) => parseTableRow(line, products) ?? parseFreeTextRow(line, products))
    .filter((row) => row.typeName || row.brand || row.model || row.serialNo || row.installedYear);
}
