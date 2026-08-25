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

const wc = analyzeDahlPriceListRows([
  ["Prislista VVS WC4"],
  header,
  ["7796165", "IFÖ SPIRA WC UNIVER 4/2 MSITS", "CB2710", "STK", "3143,00", "1", "VVS WC4", "20"],
]);
assert.equal(wc.priceListCode, "VVS WC4");
assert.equal(wc.validFrom, "2024-07-01");
assert.equal(wc.validTo, "2025-03-31");
assert.equal(wc.rows[0].supplierName, "IFÖ SPIRA WC UNIVER 4/2 MSITS");

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
