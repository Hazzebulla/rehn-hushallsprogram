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

const quickRows = parseComponentInput([
  "Panasonic CU-NE9GKE-EP luft-luftvärmepump, år 2008, skick åldrat, placering bostad.",
  "Wilo Star-RS 25/6 cirkulationspump, år okänt, skick åldrat, placering pannrum.",
  "Bosch SMU57M02SK/01 diskmaskin 2013 god kök.",
  "NIBE varmvattenberedare pannrum.",
  "Gustavsberg WC-stol god WC.",
  "Mora tvättställsblandare badrum.",
  "CTC Total värmepanna pannrum åldrat.",
].join("\n"));

assert.equal(quickRows.length, 7);

assert.deepEqual(
  quickRows.map((row) => [row.typeName, row.brand, row.model, row.installedYear, row.status, row.location]),
  [
    ["Luft-luftvärmepump", "Panasonic", "CU-NE9GKE-EP", "2008", "Åldrat", "Bostad"],
    ["Cirkulationspump", "Wilo", "Star-RS 25/6", "", "Åldrat", "Pannrum"],
    ["Diskmaskin", "Bosch", "SMU57M02SK/01", "2013", "God", "Kök"],
    ["Varmvattenberedare", "NIBE", "", "", "Ej valt", "Pannrum"],
    ["WC-stol", "Gustavsberg", "", "", "God", "WC"],
    ["Tvättställsblandare", "Mora", "", "", "Ej valt", "Badrum"],
    ["Värmepanna", "CTC", "Total", "", "Åldrat", "Pannrum"],
  ],
);

const variantRows = parseComponentInput([
  "Panasonic luftvärmepump från 2008",
  "Luftvärmepump Panasonic CU-NE9GKE-EP 2008",
  "Panasonic CU-NE9GKE-EP, 2008, pannrum, god",
  "lägg till en Panasonic luftvärmepump modell CU NE9GKE EP från 2008 i vardagsrummet skick god",
  "Luftvärmepump | Panasonic | CU-NE9GKE-EP | 2008 | God | Bostad",
].join("\n"));

assert.equal(variantRows.length, 5);
assert.equal(variantRows[0]?.typeName, "Luft-luftvärmepump");
assert.equal(variantRows[0]?.brand, "Panasonic");
assert.equal(variantRows[0]?.model, "");
assert.equal(variantRows[0]?.installedYear, "2008");
assert.equal(variantRows[0]?.status, "Ej valt");

assert.equal(variantRows[1]?.model, "CU-NE9GKE-EP");
assert.equal(variantRows[2]?.model, "CU-NE9GKE-EP");
assert.equal(variantRows[2]?.location, "Pannrum");
assert.equal(variantRows[2]?.status, "God");
assert.equal(variantRows[3]?.model, "CU-NE9GKE-EP");
assert.equal(variantRows[3]?.location, "Vardagsrum");
assert.equal(variantRows[4]?.model, "CU-NE9GKE-EP");
assert.equal(variantRows[4]?.location, "Bostad");

console.log("component-input-parser tests passed");
