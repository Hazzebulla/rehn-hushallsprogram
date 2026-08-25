export type ParsedSupplierDiscountLine = {
  rowNumber: number;
  originalRawLine: string;
  discountGroupCode: string | null;
  rawDiscountValue: string | null;
  description: string | null;
  priceLevel: string | null;
  parseStatus: "parsed" | "ignored" | "parse_error";
  errorMessage: string | null;
};

export type SupplierDiscountLetterAnalysis = {
  parserVersion: "pcl-fixed-v1";
  totalRows: number;
  parsedRows: number;
  ignoredRows: number;
  errorRows: number;
  formatSummary: {
    linePrefix: string;
    discountGroupColumns: string;
    rawDiscountColumns: string;
    fillerPattern: string;
    priceLevelPattern: string;
    note: string;
  };
  rows: ParsedSupplierDiscountLine[];
};

const PRICE_LEVEL_PATTERN = /\s(P0|P1|P2|LA|LB)\s*$/u;
const PCL_PATTERN = /^(PCL[A-Z0-9]{3})(\d{4})(0{6,})(.+)$/u;

function normalizeLine(line: string) {
  return line.replace(/\uFEFF/g, "").trimEnd();
}

export function parseSupplierDiscountLine(rawLine: string, rowNumber: number): ParsedSupplierDiscountLine {
  const originalRawLine = normalizeLine(rawLine);
  const line = originalRawLine.trim();

  if (!line) {
    return {
      rowNumber,
      originalRawLine,
      discountGroupCode: null,
      rawDiscountValue: null,
      description: null,
      priceLevel: null,
      parseStatus: "ignored",
      errorMessage: "Tom rad",
    };
  }

  if (!line.startsWith("PCL")) {
    return {
      rowNumber,
      originalRawLine,
      discountGroupCode: null,
      rawDiscountValue: null,
      description: null,
      priceLevel: null,
      parseStatus: "parse_error",
      errorMessage: "Raden börjar inte med PCL",
    };
  }

  const match = line.match(PCL_PATTERN);
  if (!match) {
    return {
      rowNumber,
      originalRawLine,
      discountGroupCode: null,
      rawDiscountValue: null,
      description: null,
      priceLevel: null,
      parseStatus: "parse_error",
      errorMessage: "Raden matchar inte fast PCL-format",
    };
  }

  const [, discountGroupCode, rawDiscountValue, , tail] = match;
  const priceLevelMatch = tail.match(PRICE_LEVEL_PATTERN);
  if (!priceLevelMatch) {
    return {
      rowNumber,
      originalRawLine,
      discountGroupCode,
      rawDiscountValue,
      description: tail.trim() || null,
      priceLevel: null,
      parseStatus: "parse_error",
      errorMessage: "Prisnivå saknas eller är okänd",
    };
  }

  const priceLevel = priceLevelMatch[1];
  const description = tail.replace(PRICE_LEVEL_PATTERN, "").replace(/\s+/g, " ").trim();
  if (!description) {
    return {
      rowNumber,
      originalRawLine,
      discountGroupCode,
      rawDiscountValue,
      description: null,
      priceLevel,
      parseStatus: "parse_error",
      errorMessage: "Beskrivning saknas",
    };
  }

  return {
    rowNumber,
    originalRawLine,
    discountGroupCode,
    rawDiscountValue,
    description,
    priceLevel,
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
    parserVersion: "pcl-fixed-v1",
    totalRows: rows.length,
    parsedRows: rows.filter((row) => row.parseStatus === "parsed").length,
    ignoredRows: rows.filter((row) => row.parseStatus === "ignored").length,
    errorRows: rows.filter((row) => row.parseStatus === "parse_error").length,
    formatSummary: {
      linePrefix: "PCL",
      discountGroupColumns: "Tecken 1-6, exempel PCL110",
      rawDiscountColumns: "Tecken 7-10, sparas som råvärde utan procenttolkning",
      fillerPattern: "Nollutfyllnad efter råvärde innan beskrivning",
      priceLevelPattern: "Radslut måste vara P0, P1, P2, LA eller LB",
      note: "Parsern tolkar inte den matematiska betydelsen av rawDiscountValue.",
    },
    rows,
  };
}
