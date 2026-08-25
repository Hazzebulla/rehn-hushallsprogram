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
  parseStatus: "ready" | "ready_with_warning" | "parsed" | "ignored" | "parse_error";
  errorMessage: string | null;
  warningMessage: string | null;
};

export type DahlPriceListAnalysis = {
  importerVersion: "dahl-price-list-v1";
  supplierName: "Dahl";
  detectedFormat: "dahl_price_table" | "dahl_price_markdown_table" | "dahl_fixed_width" | "unknown";
  metadataSource: "header" | "known_defaults" | "product_rows" | "unknown";
  priceListCode: string | null;
  priceListName: string | null;
  validFrom: string | null;
  validTo: string | null;
  headerRowNumber: number | null;
  totalRows: number;
  productRows: number;
  validRows: number;
  warningRows: number;
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

function trimTrailingEmptyCells(row: string[]) {
  const copy = [...row];
  while (copy.length && !cleanCell(copy[copy.length - 1])) copy.pop();
  return copy;
}

function isMarkdownSeparatorRow(row: string[]) {
  const cells = trimTrailingEmptyCells(row);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cleanCell(cell)));
}

function splitMarkdownTableLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return null;
  return trimTrailingEmptyCells(trimmed.replace(/^\|/u, "").replace(/\|$/u, "").split("|").map(cleanCell));
}

function normalizeInputRows(inputRows: unknown[][]) {
  const output: string[][] = [];
  let markdownRows = 0;
  let fixedWidthRows = 0;

  for (const inputRow of inputRows) {
    if (inputRow.length === 1 && typeof inputRow[0] === "string") {
      const line = inputRow[0];
      const markdownCells = splitMarkdownTableLine(inputRow[0]);
      if (markdownCells) {
        markdownRows += 1;
        if (!isMarkdownSeparatorRow(markdownCells)) output.push(markdownCells);
        continue;
      }
      if (/\b[A-ZÅÄÖ]{2,3}[A-ZÅÄÖ0-9]{3,4}\d{4,5}0{6,}/u.test(line)) fixedWidthRows += 1;
    }

    const row = trimTrailingEmptyCells(inputRow.map(cleanCell));
    if (!isMarkdownSeparatorRow(row)) output.push(row);
  }

  return {
    rows: output,
    detectedFormat: markdownRows > 0
      ? "dahl_price_markdown_table" as const
      : fixedWidthRows > 0
        ? "dahl_fixed_width" as const
        : "dahl_price_table" as const,
  };
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

function comparablePriceListCode(value: string | null | undefined) {
  return normalizePriceListCode(value)?.replace(/\s+/g, " ").trim().toUpperCase() ?? null;
}

function extractPriceListCode(line: string) {
  const cleaned = cleanCell(line);
  const match = cleaned.match(/prislista\s*:?\s+(.+?)(?=\s+(?:från|fran|till)\b|\s+20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\b|$)/iu);
  if (!match) return null;
  return normalizePriceListCode(match[1]);
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

function parseDateAfterKeyword(line: string, keywordPattern: RegExp) {
  const keyword = line.match(keywordPattern);
  if (!keyword || keyword.index === undefined) return null;
  return parseDateOnly(line.slice(keyword.index + keyword[0].length));
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
  return indexes.article >= 0 && indexes.name >= 0 && indexes.price >= 0 && indexes.priceList >= 0;
}

function cell(row: string[], index: number) {
  return index >= 0 ? cleanCell(row[index]) : "";
}

function defaultDahlIndexes() {
  return {
    article: 0,
    name: 1,
    calculationGroup: 2,
    unit: 3,
    price: 4,
    nto: 5,
    priceList: 6,
    status: 7,
  };
}

function rowLooksLikeDahlProduct(row: string[], indexes = defaultDahlIndexes()) {
  return Boolean(cell(row, indexes.article) && cell(row, indexes.name) && parseSwedishDecimal(cell(row, indexes.price)) && cell(row, indexes.priceList));
}

function extractMetadata(rows: string[][]) {
  let priceListCode: string | null = null;
  let validFrom: string | null = null;
  let validTo: string | null = null;
  let metadataSource: DahlPriceListAnalysis["metadataSource"] = "unknown";

  for (const row of rows.slice(0, 40)) {
    if (isCompleteHeader(row) || rowLooksLikeDahlProduct(row)) continue;
    const line = row.map(cleanCell).filter(Boolean).join(" ");
    const normalizedLine = line.toLowerCase();
    const parsedPriceListCode = extractPriceListCode(line);
    if (parsedPriceListCode) {
      priceListCode = parsedPriceListCode;
      metadataSource = "header";
    }
    if (!priceListCode) {
      const known = Object.keys(DAHL_KNOWN_PRICE_LISTS).find((code) => normalizedLine.includes(code.toLowerCase()));
      if (known) {
        priceListCode = known;
        metadataSource = "header";
      }
    }
    if (normalizedLine.includes("från") || normalizedLine.includes("fran")) {
      validFrom = parseDateAfterKeyword(line, /\bfrån\b|\bfran\b/iu) ?? validFrom;
    }
    if (normalizedLine.includes("till")) {
      validTo = parseDateAfterKeyword(line, /\btill\b/iu) ?? validTo;
    }
  }

  return { priceListCode, validFrom, validTo, metadataSource };
}

export function analyzeDahlPriceListRows(inputRows: unknown[][]): DahlPriceListAnalysis {
  const normalized = normalizeInputRows(inputRows);
  const sourceRows = normalized.rows;
  const headerRowIndex = sourceRows.findIndex(isCompleteHeader);
  const metadata = extractMetadata(headerRowIndex >= 0 ? sourceRows.slice(0, headerRowIndex) : sourceRows);
  const parsedRows: ParsedDahlPriceRow[] = [];

  if (headerRowIndex < 0) {
    const fallbackRows = sourceRows.filter((row) => rowLooksLikeDahlProduct(row));
    if (fallbackRows.length) {
      const fallbackIndexes = defaultDahlIndexes();
      for (const row of fallbackRows) {
        parsedRows.push(parseDahlProductRow(row, sourceRows.indexOf(row) + 1, fallbackIndexes, metadata.priceListCode));
      }

      const rowPriceCodes = new Set(parsedRows.map((row) => comparablePriceListCode(row.priceListCode)).filter(Boolean));
      const rowDerivedCode = rowPriceCodes.size === 1 ? parsedRows.find((row) => row.priceListCode)?.priceListCode ?? null : null;
      const inferredCode = metadata.priceListCode ?? rowDerivedCode ?? null;
      const known = inferredCode ? DAHL_KNOWN_PRICE_LISTS[inferredCode] : undefined;
      return buildAnalysis({
        rows: parsedRows,
        headerRowNumber: null,
        metadata: {
          priceListCode: inferredCode,
          validFrom: metadata.validFrom ?? known?.validFrom ?? null,
          validTo: metadata.validTo ?? known?.validTo ?? null,
          metadataSource: metadata.priceListCode ? metadata.metadataSource : rowDerivedCode ? "product_rows" : known ? "known_defaults" : "unknown",
        },
        detectedFormat: normalized.detectedFormat,
      });
    }

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
        warningMessage: null,
      })),
      headerRowNumber: null,
      metadata,
      detectedFormat: "unknown",
    });
  }

  const indexes = headerIndexes(sourceRows[headerRowIndex]);
  for (let rowIndex = headerRowIndex + 1; rowIndex < sourceRows.length; rowIndex += 1) {
    const row = sourceRows[rowIndex];
    if (!row.some(Boolean)) continue;
    parsedRows.push(parseDahlProductRow(row, rowIndex + 1, indexes, metadata.priceListCode));
  }

  const rowPriceCodes = new Set(parsedRows.map((row) => comparablePriceListCode(row.priceListCode)).filter(Boolean));
  const rowDerivedCode = rowPriceCodes.size === 1 ? parsedRows.find((row) => row.priceListCode)?.priceListCode ?? null : null;
  const inferredCode = metadata.priceListCode ?? rowDerivedCode ?? null;
  const known = inferredCode ? DAHL_KNOWN_PRICE_LISTS[inferredCode] : undefined;
  return buildAnalysis({
    rows: parsedRows,
    headerRowNumber: headerRowIndex + 1,
    metadata: {
      priceListCode: inferredCode,
      validFrom: metadata.validFrom ?? known?.validFrom ?? null,
      validTo: metadata.validTo ?? known?.validTo ?? null,
      metadataSource: metadata.priceListCode ? metadata.metadataSource : rowDerivedCode ? "product_rows" : known ? "known_defaults" : "unknown",
    },
    detectedFormat: normalized.detectedFormat,
  });
}

function parseDahlProductRow(
  row: string[],
  rowNumber: number,
  indexes: ReturnType<typeof defaultDahlIndexes>,
  metadataPriceListCode: string | null,
): ParsedDahlPriceRow {
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
  const warnings: string[] = [];

  if (!supplierArticleNumber) errors.push("Artnr saknas");
  if (!supplierName) errors.push("Benämning saknas");
  if (!calculationGroup) warnings.push("Kalkylgr saknas");
  if (!unit) warnings.push("Enh saknas");
  if (!priceRawValue || !priceDecimal) errors.push("Pris saknas eller har fel format");
  if (!rowPriceListCode) errors.push("Pr.l saknas");
  if (!ntoRawValue) warnings.push("Nto saknas");
  if (!statusRaw) warnings.push("Status saknas");
  if (
    metadataPriceListCode
    && rowPriceListCode
    && comparablePriceListCode(metadataPriceListCode) !== comparablePriceListCode(rowPriceListCode)
  ) {
    errors.push(`Pr.l ${rowPriceListCode} matchar inte filens prislista ${metadataPriceListCode}`);
  }

  return {
    rowNumber,
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
    parseStatus: errors.length ? "parse_error" : warnings.length ? "ready_with_warning" : "ready",
    errorMessage: errors.length ? errors.join("; ") : null,
    warningMessage: warnings.length ? warnings.join("; ") : null,
  };
}

function buildAnalysis({
  rows,
  headerRowNumber,
  metadata,
  detectedFormat,
}: {
  rows: ParsedDahlPriceRow[];
  headerRowNumber: number | null;
  metadata: {
    priceListCode: string | null;
    validFrom: string | null;
    validTo: string | null;
    metadataSource?: DahlPriceListAnalysis["metadataSource"];
  };
  detectedFormat: DahlPriceListAnalysis["detectedFormat"];
}): DahlPriceListAnalysis {
  const known = metadata.priceListCode ? DAHL_KNOWN_PRICE_LISTS[metadata.priceListCode] : undefined;
  const ready = rows.filter((row) => row.parseStatus === "ready" || row.parseStatus === "parsed").length;
  const warningRows = rows.filter((row) => row.parseStatus === "ready_with_warning").length;
  return {
    importerVersion: "dahl-price-list-v1",
    supplierName: "Dahl",
    detectedFormat,
    metadataSource: metadata.metadataSource ?? "unknown",
    priceListCode: metadata.priceListCode,
    priceListName: known?.name ?? metadata.priceListCode,
    validFrom: metadata.validFrom ?? known?.validFrom ?? null,
    validTo: metadata.validTo ?? known?.validTo ?? null,
    headerRowNumber,
    totalRows: rows.length,
    productRows: rows.filter((row) => row.parseStatus !== "ignored").length,
    validRows: ready + warningRows,
    warningRows,
    invalidRows: rows.filter((row) => row.parseStatus === "parse_error").length,
    ignoredRows: rows.filter((row) => row.parseStatus === "ignored").length,
    formatSummary: {
      requiredColumns: ["Artnr", "Benämning", "Kalkylgr", "Enh", "Pris", "Nto", "Pr.l", "Status"],
      dateRule: "Datum sparas som date-only, utan tidszonsförskjutning.",
      priceRule: "Svenskt decimalformat konverteras till Decimal-sträng, t.ex. 35,23 -> 35.23.",
      articleRule: "Artnr sparas alltid som supplierArticleNumber. Endast sjusiffrigt numeriskt artnr kopieras till rskNumber som preliminär match.",
      note: "Kalkylgr, Nto och Status sparas rått. Saknade värden blir varning, inte parse_error. Ingen rabattmatematik görs.",
    },
    rows,
  };
}
