import { strict as assert } from "assert";
import { analyzeSupplierDiscountLetter, parseSupplierDiscountLine } from "./supplier-discount-letter-parser";

const examples = [
  ["PCL110035300000000000000000TERMOSTATBLANDARE, FMM P0", "PCL110", "0353", "TERMOSTATBLANDARE, FMM", "P0"],
  ["PCL111034600000000000000000TERMOSTATBLANDARE, FMM P1", "PCL111", "0346", "TERMOSTATBLANDARE, FMM", "P1"],
  ["PCL112033700000000000000000TERMOSTATBLANDARE, FMM P2", "PCL112", "0337", "TERMOSTATBLANDARE, FMM", "P2"],
  ["PCL11A032400000000000000000TERMOSTATBLANDARE, FMM LA", "PCL11A", "0324", "TERMOSTATBLANDARE, FMM", "LA"],
  ["PCL11B032400000000000000000TERMOSTATBLANDARE, FMM LB", "PCL11B", "0324", "TERMOSTATBLANDARE, FMM", "LB"],
] as const;

for (const [line, discountGroupCode, rawDiscountValue, description, priceLevel] of examples) {
  const parsed = parseSupplierDiscountLine(line, 1);
  assert.equal(parsed.parseStatus, "parsed");
  assert.equal(parsed.discountGroupCode, discountGroupCode);
  assert.equal(parsed.rawDiscountValue, rawDiscountValue);
  assert.equal(parsed.description, description);
  assert.equal(parsed.priceLevel, priceLevel);
}

const broken = parseSupplierDiscountLine("PCL11B032400000000000000000TERMOSTATBLANDARE, FMM", 1);
assert.equal(broken.parseStatus, "parse_error");
assert.equal(broken.rawDiscountValue, "0324");

const analysis = analyzeSupplierDiscountLetter(`${examples.map(([line]) => line).join("\n")}\nTRASIG RAD`);
assert.equal(analysis.totalRows, 6);
assert.equal(analysis.parsedRows, 5);
assert.equal(analysis.errorRows, 1);

console.log("supplier-discount-letter-parser tests passed");
