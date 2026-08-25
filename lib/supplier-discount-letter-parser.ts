export type ParsedSupplierDiscountLine = {
  rowNumber: number;
  originalRawLine: string;
  customerPrefix: string | null;
  discountGroupCode: string | null;
  rawDiscountValue: string | null;
  description: string | null;
  priceLevel: string | null;
  validityDate: string | null;
  parseStatus: "parsed" | "ignored" | "parse_error";
  errorMessage: string | null;
};

export type SupplierDiscountLetterAnalysis = {
  parserVersion: "discount-letter-generic-v2";
  totalRows: number;
  parsedRows: number;
  ignoredRows: number;
  errorRows: number;
  formatSummary: {
    recordPattern: string;
    prefixPattern: string;
    discountGroupPattern: string;
    rawDiscountColumns: string;
    fillerPattern: string;
    priceLevelPattern: string;
    datePattern: string;
    note: string;
  };
  rows: ParsedSupplierDiscountLine[];
};

const PRICE_LEVEL_PATTERN = /\s(P0|P1|P2|LA|LB)\s*$/u;
const TRAILING_DATE_PATTERN = /\s*(\d{6})\s*$/u;
const CODE_5 = "(?:[A-ZÅÄÖ\\uFFFD]{2}[A-ZÅÄÖ\\uFFFD0-9]{3}|[A-ZÅÄÖ\\uFFFD]{3}[A-ZÅÄÖ\\uFFFD0-9]{2})";
const CODE_6 = "(?:[A-ZÅÄÖ\\uFFFD]{2}[A-ZÅÄÖ\\uFFFD0-9]{4}|[A-ZÅÄÖ\\uFFFD]{3}[A-ZÅÄÖ\\uFFFD0-9]{3})";
const DISCOUNT_RECORD_PATTERNS = [
  new RegExp(`(${CODE_5})\\s*(\\d{4})(0{6,})(.+)$`, "u"),
  new RegExp(`(${CODE_5})\\s*(\\d{5})(0{6,})(.+)$`, "u"),
  new RegExp(`(${CODE_6})\\s*(\\d{4})(0{6,})(.+)$`, "u"),
  new RegExp(`(${CODE_6})\\s*(\\d{5})(0{6,})(.+)$`, "u"),
];

function countReplacementCharacters(value: string) {
  return [...value].filter((char) => char === "\uFFFD").length;
}

function discountCodePriority(code: string) {
  const startsWithThreeLetters = /^[A-ZÅÄÖ\uFFFD]{3}/u.test(code);
  if (startsWithThreeLetters && code.length === 6) return 0;
  if (!startsWithThreeLetters && code.length === 5) return 0;
  if (!startsWithThreeLetters && code.length === 6) return 1;
  return 3;
}

export function decodeSupplierDiscountLetterText(bytes: ArrayBuffer) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  if (countReplacementCharacters(utf8) === 0) return utf8;

  try {
    return new TextDecoder("windows-1252", { fatal: false }).decode(bytes);
  } catch {
    return utf8;
  }
}

function normalizeLine(line: string) {
  return line.replace(/\uFEFF/g, "").trimEnd();
}

function emptyResult(
  rowNumber: number,
  originalRawLine: string,
  errorMessage: string,
  parseStatus: "ignored" | "parse_error" = "parse_error",
): ParsedSupplierDiscountLine {
  return {
    rowNumber,
    originalRawLine,
    customerPrefix: null,
    discountGroupCode: null,
    rawDiscountValue: null,
    description: null,
    priceLevel: null,
    validityDate: null,
    parseStatus,
    errorMessage,
  };
}

function parseYyMmDd(value: string) {
  if (!/^\d{6}$/u.test(value)) return null;
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateOnlyToPrismaDate(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
}

export function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function parseSupplierDiscountLine(rawLine: string, rowNumber: number): ParsedSupplierDiscountLine {
  const originalRawLine = normalizeLine(rawLine);
  const line = originalRawLine;

  if (!line.trim()) {
    return emptyResult(rowNumber, originalRawLine, "Tom rad", "ignored");
  }

  const dateMatch = line.match(TRAILING_DATE_PATTERN);
  const validityDate = dateMatch ? parseYyMmDd(dateMatch[1]) : null;
  const lineWithoutDate = dateMatch ? line.slice(0, dateMatch.index).trimEnd() : line;
  if (dateMatch && !validityDate) {
    return emptyResult(rowNumber, originalRawLine, `Ogiltigt datum: ${dateMatch[1]}`);
  }

  const match = DISCOUNT_RECORD_PATTERNS
    .map((pattern, priority) => ({ result: lineWithoutDate.match(pattern), priority }))
    .filter((item): item is { result: RegExpMatchArray; priority: number } => Boolean(item.result))
    .sort((a, b) => (
      (a.result.index ?? 0) - (b.result.index ?? 0)
      || discountCodePriority(a.result[1]) - discountCodePriority(b.result[1])
      || a.priority - b.priority
    ))[0]?.result;
  if (!match || match.index === undefined) {
    return emptyResult(rowNumber, originalRawLine, "Rabattgrupp/råvärde/nollutfyllnad kunde inte identifieras");
  }

  const [, discountGroupCode, rawDiscountValue, , tail] = match;
  const customerPrefix = lineWithoutDate.slice(0, match.index).trim() || null;
  const priceLevelMatch = tail.match(PRICE_LEVEL_PATTERN);
  const priceLevel = priceLevelMatch ? priceLevelMatch[1] : null;
  const description = (priceLevelMatch ? tail.replace(PRICE_LEVEL_PATTERN, "") : tail).replace(/\s+/g, " ").trim();

  if (!description) {
    return {
      rowNumber,
      originalRawLine,
      customerPrefix,
      discountGroupCode,
      rawDiscountValue,
      description: null,
      priceLevel,
      validityDate,
      parseStatus: "parse_error",
      errorMessage: "Beskrivning saknas",
    };
  }

  return {
    rowNumber,
    originalRawLine,
    customerPrefix,
    discountGroupCode,
    rawDiscountValue,
    description,
    priceLevel,
    validityDate,
    parseStatus: "parsed",
    errorMessage: null,
  };
}

export function analyzeSupplierDiscountLetter(rawText: string): SupplierDiscountLetterAnalysis {
  const rows = rawText
    .split(/\r?\n/)
    .map((line, index) => parseSupplierDiscountLine(line, index + 1))
    .filter((row) => row.parseStatus !== "ignored" || row.originalRawLine);

  return {
    parserVersion: "discount-letter-generic-v2",
    totalRows: rows.length,
    parsedRows: rows.filter((row) => row.parseStatus === "parsed").length,
    ignoredRows: rows.filter((row) => row.parseStatus === "ignored").length,
    errorRows: rows.filter((row) => row.parseStatus === "parse_error").length,
    formatSummary: {
      recordPattern: "[prefix][spacing][gruppkod][4-siffrigt råvärde][nollutfyllnad][beskrivning][YYMMDD]",
      prefixPattern: "Allt före rabattgruppen sparas som kund-/avtalsprefix i parsern",
      discountGroupPattern: "5-6 tecken, inklusive svenska tecken och nivåsuffix, exempel BA010, BÅ010, CÅÄ01, BA036B, CA105A, PCL110, PCM110, TF460",
      rawDiscountColumns: "De fyra tecknen direkt efter gruppkoden. Om radtypen inte passar testas femsiffrigt råvärde. Värdet sparas alltid rått utan procenttolkning.",
      fillerPattern: "Minst sex nollor efter råvärdet innan beskrivningen",
      priceLevelPattern: "Radslut i beskrivningen kan vara P0, P1, P2, LA eller LB. Saknas prisnivå sparas null.",
      datePattern: "Sista sex siffrorna tolkas som YYMMDD, exempel 241231 -> 2024-12-31",
      note: "Parsern tolkar inte den matematiska betydelsen av rawDiscountValue.",
    },
    rows,
  };
}
