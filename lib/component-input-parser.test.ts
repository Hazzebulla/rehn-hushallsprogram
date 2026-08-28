import assert from "node:assert/strict";
import { parseComponentInput } from "./component-input-parser";

const rows = parseComponentInput([
  "NIBE F1245-8 2016 serienr ABC123",
  "ESBE VTA323 2023",
  "2 st FM Mattsson 9000 XE 2022",
  "Grundfos Alpha2 25-60 pannrum",
  "Altech N18",
].join("\n"));

assert.equal(rows.length, 6);

assert.deepEqual(
  rows.map((row) => row.typeName),
  ["Värmepump", "Blandningsventil", "Blandare", "Blandare", "Cirkulationspump", "Expansionskärl"],
);

assert.equal(rows[0]?.brand, "NIBE");
assert.equal(rows[0]?.model, "F1245-8");
assert.equal(rows[0]?.installedYear, "2016");
assert.equal(rows[0]?.serialNo, "ABC123");

assert.equal(rows[1]?.brand, "ESBE");
assert.equal(rows[1]?.model, "VTA323");
assert.equal(rows[1]?.installedYear, "2023");
assert.equal(rows[1]?.serialNo, "");

assert.equal(rows[2]?.model, "9000 XE");
assert.equal(rows[3]?.model, "9000 XE");
assert.equal(rows[2]?.installedYear, "2022");
assert.equal(rows[3]?.installedYear, "2022");

assert.equal(rows[4]?.brand, "Grundfos");
assert.equal(rows[4]?.model, "ALPHA2 25-60");
assert.equal(rows[4]?.installedYear, "");
assert.equal(rows[4]?.serialNo, "");
assert.equal(rows[4]?.location, "Pannrum");
assert.match(rows[4]?.warnings?.join(" ") ?? "", /Årtal saknas/);

assert.equal(rows[5]?.brand, "Altech");
assert.equal(rows[5]?.model, "N18");
assert.equal(rows[5]?.installedYear, "");
assert.equal(rows[5]?.serialNo, "");
assert.match(rows[5]?.warnings?.join(" ") ?? "", /Årtal saknas/);

console.log("component-input-parser tests passed");
