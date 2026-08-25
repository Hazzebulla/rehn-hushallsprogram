import { strict as assert } from "assert";
import {
  analyzeSupplierDiscountLetter,
  dateOnlyToPrismaDate,
  decodeSupplierDiscountLetterText,
  formatDateOnly,
  parseSupplierDiscountLine,
} from "./supplier-discount-letter-parser";

const fmm = parseSupplierDiscountLine(
  "1N6171694                    PCL110035300000000000000000TERMOSTATBLANDARE, FMM P0     241231",
  1,
);
assert.equal(fmm.parseStatus, "parsed");
assert.equal(fmm.customerPrefix, "1N6171694");
assert.equal(fmm.discountGroupCode, "PCL110");
assert.equal(fmm.rawDiscountValue, "0353");
assert.equal(fmm.description, "TERMOSTATBLANDARE, FMM");
assert.equal(fmm.priceLevel, "P0");
assert.equal(fmm.validityDate, "2024-12-31");

const examples = [
  ["1N6171694                    PCL111034600000000000000000TERMOSTATBLANDARE, FMM P1     241231", "PCL111", "0346", "P1"],
  ["1N6171694                    PCL112033700000000000000000TERMOSTATBLANDARE, FMM P2     241231", "PCL112", "0337", "P2"],
  ["1N6171694                    PCL11A032400000000000000000TERMOSTATBLANDARE, FMM LA     241231", "PCL11A", "0324", "LA"],
  ["1N6171694                    PCL11B032400000000000000000TERMOSTATBLANDARE, FMM LB     241231", "PCL11B", "0324", "LB"],
  ["1N6171694                    BA010012300000000000000000KOPPLINGAR OCH RORDELAR P0     241231", "BA010", "0123", "P0"],
  ["1N6171694                    CA600045600000000000000000CIRKULATIONSPUMPAR LA     241231", "CA600", "0456", "LA"],
  ["1N6171694                    PCM110078900000000000000000VARMEPUMPAR P2     241231", "PCM110", "0789", "P2"],
  ["1N6171694                    PCP130000000000000000000000INSTALLATIONSMATERIAL LB     241231", "PCP130", "0000", "LB"],
  ["1N6171694                    TF460099900000000000000000SANITETSPRODUKTER P1     241231", "TF460", "0999", "P1"],
  ["1N6171694                    BÅ010004200000000000000000BANSK TVÄTT & TORK     241231", "BÅ010", "0042", null],
] as const;

for (const [line, discountGroupCode, rawDiscountValue, priceLevel] of examples) {
  const parsed = parseSupplierDiscountLine(line, 1);
  assert.equal(parsed.parseStatus, "parsed");
  assert.equal(parsed.discountGroupCode, discountGroupCode);
  assert.equal(parsed.rawDiscountValue, rawDiscountValue);
  assert.equal(parsed.priceLevel, priceLevel);
  assert.equal(parsed.validityDate, "2024-12-31");
}

const noPriceLevel = parseSupplierDiscountLine("1N6171694                    BA010012300000000000000000KOPPLINGAR OCH RORDELAR     241231", 1);
assert.equal(noPriceLevel.parseStatus, "parsed");
assert.equal(noPriceLevel.priceLevel, null);
assert.equal(noPriceLevel.description, "KOPPLINGAR OCH RORDELAR");

const fiveDigitRaw = parseSupplierDiscountLine(" 1N6171694                    BA0100022200000000000000000DISKMASKINER BSH              241231", 1);
assert.equal(fiveDigitRaw.parseStatus, "parsed");
assert.equal(fiveDigitRaw.discountGroupCode, "BA010");
assert.equal(fiveDigitRaw.rawDiscountValue, "00222");
assert.equal(fiveDigitRaw.description, "DISKMASKINER BSH");
assert.equal(fiveDigitRaw.validityDate, "2024-12-31");

const suffixedGroup = parseSupplierDiscountLine(" 1N6171694                    CA105A039900000000000000000ARMERINGSSTÅL LA              241231", 1);
assert.equal(suffixedGroup.parseStatus, "parsed");
assert.equal(suffixedGroup.discountGroupCode, "CA105A");
assert.equal(suffixedGroup.rawDiscountValue, "0399");
assert.equal(suffixedGroup.description, "ARMERINGSSTÅL");
assert.equal(suffixedGroup.priceLevel, "LA");

const spacedRaw = parseSupplierDiscountLine(" 1N6171694                    CÅÄ01 055400000000000000000CANSK ARMERINGSSTÅL OCH NÄT   241231", 1);
assert.equal(spacedRaw.parseStatus, "parsed");
assert.equal(spacedRaw.discountGroupCode, "CÅÄ01");
assert.equal(spacedRaw.rawDiscountValue, "0554");
assert.equal(spacedRaw.description, "CANSK ARMERINGSSTÅL OCH NÄT");

const broken = parseSupplierDiscountLine("1N6171694                    TRASIG RAD     241231", 1);
assert.equal(broken.parseStatus, "parse_error");
assert.equal(broken.description, null);
assert.equal(broken.errorMessage, "Rabattgrupp/råvärde/nollutfyllnad kunde inte identifieras");

const date = dateOnlyToPrismaDate("2024-12-31");
assert.equal(formatDateOnly(date), "2024-12-31");

const windows1252 = new Uint8Array([
  ...Buffer.from("1N6171694                    B", "ascii"),
  0xc5,
  ...Buffer.from("010004200000000000000000BANSK TV", "ascii"),
  0xc4,
  ...Buffer.from("TT & TORK     241231", "ascii"),
]).buffer;
const decoded = decodeSupplierDiscountLetterText(windows1252);
assert.equal(decoded.includes("BÅ010"), true);
assert.equal(decoded.includes("TVÄTT"), true);

const analysis = analyzeSupplierDiscountLetter(`${examples.map(([line]) => line).join("\n")}\nTRASIG RAD`);
assert.equal(analysis.totalRows, 11);
assert.equal(analysis.parsedRows, 10);
assert.equal(analysis.errorRows, 1);

console.log("supplier-discount-letter-parser tests passed");
