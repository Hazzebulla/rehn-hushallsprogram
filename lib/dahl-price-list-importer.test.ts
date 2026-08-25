import { strict as assert } from "assert";
import { analyzeDahlPriceListRows, dateOnlyToPrismaDate } from "./dahl-price-list-importer";
import { formatDateOnly } from "./supplier-discount-letter-parser";

const header = ["Artnr", "Benämning", "Kalkylgr", "Enh", "Pris", "Nto", "Pr.l", "Status"];

const vp = analyzeDahlPriceListRows([
  ["Prislista 201VP1"],
  ["Från 2024-08-01"],
  ["Till 2025-01-31"],
  header,
  ["6203778", "BOSCH ELPANNA AWM 9", "AA2210", "STK", "32500,00", "1", "201VP1", "20"],
  ["K4551017", "ALFANUMERISK ARTIKEL", "AA2120", "STK", "35,23", "1", "201VP1", "20"],
  [],
]);
assert.equal(vp.priceListCode, "201VP1");
assert.equal(vp.validFrom, "2024-08-01");
assert.equal(vp.validTo, "2025-01-31");
assert.equal(vp.validRows, 2);
assert.equal(vp.invalidRows, 0);
assert.equal(vp.rows[0].supplierArticleNumber, "6203778");
assert.equal(vp.rows[0].rskNumber, "6203778");
assert.equal(vp.rows[0].priceDecimal, "32500.00");
assert.equal(vp.rows[1].supplierArticleNumber, "K4551017");
assert.equal(vp.rows[1].rskNumber, null);
assert.equal(vp.rows[1].priceDecimal, "35.23");

const combinedHeader = analyzeDahlPriceListRows([
  ["Prislista 201VP1", "Från 2024-08-01", "Till 2025-01-31"],
  header,
  ["6203778", "BOSCH ELPANNA AWM 9", "AA2210", "STK", "32500,00", "1", "201VP1", "20"],
]);
assert.equal(combinedHeader.priceListCode, "201VP1");
assert.equal(combinedHeader.validFrom, "2024-08-01");
assert.equal(combinedHeader.validTo, "2025-01-31");
assert.equal(combinedHeader.validRows, 1);
assert.equal(combinedHeader.invalidRows, 0);

const inlineHeader = analyzeDahlPriceListRows([
  ["Prislista 201VP1 Från 2024-08-01 Till 2025-01-31"],
  header,
  ["6203778", "BOSCH ELPANNA AWM 9", "AA2210", "STK", "32500,00", "1", "201VP1", "20"],
]);
assert.equal(inlineHeader.priceListCode, "201VP1");
assert.equal(inlineHeader.validFrom, "2024-08-01");
assert.equal(inlineHeader.validTo, "2025-01-31");
assert.equal(inlineHeader.invalidRows, 0);

const markdownTable = analyzeDahlPriceListRows([
  ["| Prislista 201VP1 | | | Från | 2024-08-01 |"],
  ["| | | | Till | 2025-01-31 |"],
  ["| Artnr | Benämning | Kalkylgr | Enh | Pris | Nto | Pr.l | Status | | |"],
  ["| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"],
  ["| 6203778 | BOSCH ELPANNA AWM 9 | AA2210 | STK | 32500,00 | 1 | 201VP1 | 20 | | |"],
]);
assert.equal(markdownTable.detectedFormat, "dahl_price_markdown_table");
assert.equal(markdownTable.metadataSource, "header");
assert.equal(markdownTable.priceListCode, "201VP1");
assert.equal(markdownTable.validFrom, "2024-08-01");
assert.equal(markdownTable.validTo, "2025-01-31");
assert.equal(markdownTable.validRows, 1);
assert.equal(markdownTable.invalidRows, 0);

const derivedFromRows = analyzeDahlPriceListRows([
  header,
  ["6203778", "BOSCH ELPANNA AWM 9", "AA2210", "STK", "32500,00", "1", "201VP1", "20"],
  ["6203779", "BOSCH ELPANNA AWM 13", "AA2210", "STK", "35500,00", "1", "201VP1", "20"],
]);
assert.equal(derivedFromRows.priceListCode, "201VP1");
assert.equal(derivedFromRows.metadataSource, "product_rows");
assert.equal(derivedFromRows.validRows, 2);

const noHeaderButOrderedRows = analyzeDahlPriceListRows([
  ["6203778", "BOSCH ELPANNA AWM 9", "AA2210", "STK", "32500,00", "1", "201VP1", "20"],
  ["6203779", "BOSCH ELPANNA AWM 13", "AA2210", "STK", "35500,00", "1", "201VP1", "20"],
]);
assert.equal(noHeaderButOrderedRows.headerRowNumber, null);
assert.equal(noHeaderButOrderedRows.priceListCode, "201VP1");
assert.equal(noHeaderButOrderedRows.metadataSource, "product_rows");
assert.equal(noHeaderButOrderedRows.validRows, 2);
assert.equal(noHeaderButOrderedRows.invalidRows, 0);

const warningOnly = analyzeDahlPriceListRows([
  ["Artnr", "Benämning", "Pris", "Pr.l"],
  ["6203778", "BOSCH ELPANNA AWM 9", "32500,00", "201VP1"],
]);
assert.equal(warningOnly.validRows, 1);
assert.equal(warningOnly.warningRows, 1);
assert.equal(warningOnly.invalidRows, 0);

const wc = analyzeDahlPriceListRows([
  ["Prislista VVS WC4"],
  header,
  ["7796165", "IFÖ SPIRA WC UNIVER 4/2 MSITS", "CB2710", "STK", "3143,00", "1", "VVS WC4", "20"],
]);
assert.equal(wc.priceListCode, "VVS WC4");
assert.equal(wc.validFrom, "2024-07-01");
assert.equal(wc.validTo, "2025-03-31");
assert.equal(wc.rows[0].supplierName, "IFÖ SPIRA WC UNIVER 4/2 MSITS");

const wcAfterFormSheet = analyzeDahlPriceListRows([
  ["txtKundOrt", ""],
  ["txtKundTel", ""],
  ["optVVS", "TRUE"],
  ["Prislista VVS WC4"],
  ["Från 2024-07-01"],
  ["Till 2025-03-31"],
  header,
  ["7796165", "IFÖ SPIRA WC UNIVER 4/2 MSITS", "CB2710", "STK", "3143,00", "1", "VVS WC4", "20"],
]);
assert.equal(wcAfterFormSheet.priceListCode, "VVS WC4");
assert.equal(wcAfterFormSheet.validRows, 1);
assert.equal(wcAfterFormSheet.invalidRows, 0);

const mark = analyzeDahlPriceListRows([
  ["Prislista VVSMARK3"],
  header,
  ["2350007", "PVC MARKRÖR 110X6M", "HC0902", "STK", "320,00", "1", "VVSMARK3", "20"],
  ["2350008", "PVC MARKRÖR METER", "HC1312", "M", "23,50", "1", "VVSMARK3", "20"],
  ["", "", "", "", "", "", "", ""],
]);
assert.equal(mark.priceListCode, "VVSMARK3");
assert.equal(mark.validRows, 2);
assert.equal(mark.rows[0].calculationGroup, "HC0902");
assert.equal(mark.rows[1].unit, "M");
assert.equal(mark.rows[1].priceDecimal, "23.50");

const mismatch = analyzeDahlPriceListRows([
  ["Prislista VVS WC4"],
  header,
  ["7796165", "IFÖ SPIRA", "CB2710", "STK", "3143,00", "1", "VVSMARK3", "20"],
]);
assert.equal(mismatch.invalidRows, 1);
assert.match(mismatch.rows[0].errorMessage ?? "", /matchar inte/);

assert.equal(formatDateOnly(dateOnlyToPrismaDate("2025-03-31")), "2025-03-31");

console.log("dahl-price-list-importer tests passed");
