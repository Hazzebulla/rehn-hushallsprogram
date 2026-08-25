import { createHash } from "crypto";

export type ParsedDahlPriceRow = {
  rowNumber: number;
  originalRawRow: string[];
  supplierArticleNumber: string | null;
  rskNumber: string | null;
  supplierName: string | null;
  calculationGroup: string | null;
  unit: string | null;
  priceRawValue: string | null;
  priceDecimal: string | null;
  ntoRawValue: string | null;
  priceListCode: string | null;
  statusRaw: string | null;
  parseStatus: "parsed" | "ignored" | "parse_error";
  errorMessage: string | null;
};

export type DahlPriceListAnalysis = {
  importerVersion: "dahl-price-list-v1";
  supplierName: "Dahl";
  priceListCode: string | null;
  priceListName: string | null;
  validFrom: string | null;
  validTo: string | null;
  headerRowNumber: number | null;
  totalRows: number;
  productRows: number;
  validRows: number;
  invalidRows: number;
  ignoredRows: number;
  formatSummary: {
    requiredColumns: string[];
    dateRule: string;
    priceRule: string;
    articleRule: string;
    note: string;
  };
  rows: ParsedDahlPriceRow[];
};

const DAHL_KNOWN_PRICE_LISTS: Record<string, { validFrom: string; validTo: string; name: string }> = {
  "201VP1": { validFrom: "2024-08-01", validTo: "2025-01-31", name: "201VP1" },
  "VVS WC4": { validFrom: "2024-07-01", validTo: "2025-03-31", name: "VVS WC4" },
  VVSMARK3: { validFrom: "2024-07-01", validTo: "2025-03-31", name: "VVSMARK3" },
};

function cleanCell(value: unknown) {
  return String(value ?? "").replace(/\uFEFF/g, "").replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string) {
  return cleanCell(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizePriceListCode(value: string | null | undefined) {
  const cleaned = cleanCell(value).toUpperCase();
  if (!cleaned) return null;
  if (cleaned.replace(/\s+/g, "") === "VVSWC4") return "VVS WC4";
  return cleaned;
}

function parseDateOnly(value: string) {
  const cleaned = cleanCell(value);
  const iso = cleaned.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/u);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    return validateDateOnly(year, month, day);
  }

  const compact = cleaned.match(/\b(\d{6})\b/u);
  if (compact) {
    const year = 2000 + Number(compact[1].slice(0, 2));
    const month = Number(compact[1].slice(2, 4));
    const day = Number(compact[1].slice(4, 6));
    return validateDateOnly(year, month, day);
  }

  return null;
}

function validateDateOnly(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateOnlyToPrismaDate(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
}

export function dahlFileHash(bytes: Buffer | ArrayBuffer | Uint8Array) {
  return createHash("sha256").update(bytes instanceof ArrayBuffer ? Buffer.from(new Uint8Array(bytes)) : Buffer.from(bytes)).digest("hex");
}

function parseSwedishDecimal(value: string) {
  const raw = cleanCell(value).replace(/\s/g, "");
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/u.test(normalized)) return null;
  const [whole, decimals = ""] = normalized.split(".");
  return `${whole}.${decimals.padEnd(2, "0").slice(0, 2)}`;
}

function inferRskNumber(articleNumber: string) {
  return /^\d{7}$/u.test(articleNumber) ? articleNumber : null;
}

function headerIndexes(row: string[]) {
  const normalized = row.map(normalizeHeader);
  const find = (names: string[]) => normalized.findIndex((header) => names.includes(header));
  return {
    article: find(["artnr", "artikelnummer", "artikelnr"]),
    name: find(["benamning", "namn", "produktnamn"]),
    calculationGroup: find(["kalkylgr", "kalkylgrupp"]),
    unit: find(["enh", "enhet"]),
    price: find(["pris"]),
    nto: find(["nto"]),
    priceList: find(["prl", "prislista"]),
    status: find(["status"]),
  };
}

function isCompleteHeader(row: string[]) {
  const indexes = headerIndexes(row);
  return indexes.article >= 0 && indexes.name >= 0 && indexes.calculationGroup >= 0 && indexes.unit >= 0 && indexes.price >= 0 && indexes.priceList >= 0;
}

function cell(row: string[], index: number) {
  return index >= 0 ? cleanCell(row[index]) : "";
}

function extractMetadata(rows: string[][]) {
  let priceListCode: string | null = null;
  let validFrom: string | null = null;
  let validTo: string | null = null;

  for (const row of rows.slice(0, 40)) {
    const line = row.map(cleanCell).filter(Boolean).join(" ");
    const normalizedLine = line.toLowerCase();
    const priceListMatch = line.match(/prislista\s+(.+)$/iu);
    if (priceListMatch) priceListCode = normalizePriceListCode(priceListMatch[1]);
    if (!priceListCode) {
      const known = Object.keys(DAHL_KNOWN_PRICE_LISTS).find((code) => normalizedLine.includes(code.toLowerCase()));
      if (known) priceListCode = known;
    }
    if (normalizedLine.includes("från") || normalizedLine.includes("fran")) validFrom = parseDateOnly(line) ?? validFrom;
    if (normalizedLine.includes("till")) validTo = parseDateOnly(line) ?? validTo;
  }

  return { priceListCode, validFrom, validTo };
}

export function analyzeDahlPriceListRows(inputRows: unknown[][]): DahlPriceListAnalysis {
  const sourceRows = inputRows.map((row) => row.map(cleanCell));
  const metadata = extractMetadata(sourceRows);
  const headerRowIndex = sourceRows.findIndex(isCompleteHeader);
  const parsedRows: ParsedDahlPriceRow[] = [];

  if (headerRowIndex < 0) {
    return buildAnalysis({
      rows: sourceRows.map((row, index) => ({
        rowNumber: index + 1,
        originalRawRow: row,
        supplierArticleNumber: null,
        rskNumber: null,
        supplierName: null,
        calculationGroup: null,
        unit: null,
        priceRawValue: null,
        priceDecimal: null,
        ntoRawValue: null,
        priceListCode: null,
        statusRaw: null,
        parseStatus: row.some(Boolean) ? "parse_error" : "ignored",
        errorMessage: row.some(Boolean) ? "Rubrikrad för Dahl-prislista hittades inte" : "Tom rad",
      })),
      headerRowNumber: null,
      metadata,
    });
  }

  const indexes = headerIndexes(sourceRows[headerRowIndex]);
  for (let rowIndex = headerRowIndex + 1; rowIndex < sourceRows.length; rowIndex += 1) {
    const row = sourceRows[rowIndex];
    if (!row.some(Boolean)) continue;

    const supplierArticleNumber = cell(row, indexes.article);
    const supplierName = cell(row, indexes.name);
    const calculationGroup = cell(row, indexes.calculationGroup);
    const unit = cell(row, indexes.unit);
    const priceRawValue = cell(row, indexes.price);
    const priceDecimal = parseSwedishDecimal(priceRawValue);
    const ntoRawValue = cell(row, indexes.nto) || null;
    const rowPriceListCode = normalizePriceListCode(cell(row, indexes.priceList));
    const statusRaw = cell(row, indexes.status) || null;
    const errors: string[] = [];

    if (!supplierArticleNumber) errors.push("Artnr saknas");
    if (!supplierName) errors.push("Benämning saknas");
    if (!calculationGroup) errors.push("Kalkylgr saknas");
    if (!unit) errors.push("Enh saknas");
    if (!priceRawValue || !priceDecimal) errors.push("Pris saknas eller har fel format");
    if (!rowPriceListCode) errors.push("Pr.l saknas");
    if (metadata.priceListCode && rowPriceListCode && metadata.priceListCode !== rowPriceListCode) {
      errors.push(`Pr.l ${rowPriceListCode} matchar inte filens prislista ${metadata.priceListCode}`);
    }

    parsedRows.push({
      rowNumber: rowIndex + 1,
      originalRawRow: row,
      supplierArticleNumber: supplierArticleNumber || null,
      rskNumber: supplierArticleNumber ? inferRskNumber(supplierArticleNumber) : null,
      supplierName: supplierName || null,
      calculationGroup: calculationGroup || null,
      unit: unit || null,
      priceRawValue: priceRawValue || null,
      priceDecimal,
      ntoRawValue,
      priceListCode: rowPriceListCode,
      statusRaw,
      parseStatus: errors.length ? "parse_error" : "parsed",
      errorMessage: errors.length ? errors.join("; ") : null,
    });
  }

  const inferredCode = metadata.priceListCode ?? parsedRows.find((row) => row.priceListCode)?.priceListCode ?? null;
  const known = inferredCode ? DAHL_KNOWN_PRICE_LISTS[inferredCode] : undefined;
  return buildAnalysis({
    rows: parsedRows,
    headerRowNumber: headerRowIndex + 1,
    metadata: {
      priceListCode: inferredCode,
      validFrom: metadata.validFrom ?? known?.validFrom ?? null,
      validTo: metadata.validTo ?? known?.validTo ?? null,
    },
  });
}

function buildAnalysis({
  rows,
  headerRowNumber,
  metadata,
}: {
  rows: ParsedDahlPriceRow[];
  headerRowNumber: number | null;
  metadata: { priceListCode: string | null; validFrom: string | null; validTo: string | null };
}): DahlPriceListAnalysis {
  const known = metadata.priceListCode ? DAHL_KNOWN_PRICE_LISTS[metadata.priceListCode] : undefined;
  return {
    importerVersion: "dahl-price-list-v1",
    supplierName: "Dahl",
    priceListCode: metadata.priceListCode,
    priceListName: known?.name ?? metadata.priceListCode,
    validFrom: metadata.validFrom ?? known?.validFrom ?? null,
    validTo: metadata.validTo ?? known?.validTo ?? null,
    headerRowNumber,
    totalRows: rows.length,
    productRows: rows.filter((row) => row.parseStatus !== "ignored").length,
    validRows: rows.filter((row) => row.parseStatus === "parsed").length,
    invalidRows: rows.filter((row) => row.parseStatus === "parse_error").length,
    ignoredRows: rows.filter((row) => row.parseStatus === "ignored").length,
    formatSummary: {
      requiredColumns: ["Artnr", "Benämning", "Kalkylgr", "Enh", "Pris", "Nto", "Pr.l", "Status"],
      dateRule: "Datum sparas som date-only, utan tidszonsförskjutning.",
      priceRule: "Svenskt decimalformat konverteras till Decimal-sträng, t.ex. 35,23 -> 35.23.",
      articleRule: "Artnr sparas alltid som supplierArticleNumber. Endast sjusiffrigt numeriskt artnr kopieras till rskNumber som preliminär match.",
      note: "Kalkylgr, Nto och Status sparas rått och används inte som rabattmatematik.",
    },
    rows,
  };
}
