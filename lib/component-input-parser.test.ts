import assert from "node:assert/strict";
import { parseComponentInput, type ComponentProductOption } from "./component-input-parser";

const products: ComponentProductOption[] = [
  {
    id: "prod_nibe_f1245_8",
    category: "Värmesystem",
    manufacturer: "NIBE",
    productName: "NIBE F1245-8",
    modelName: "F1245-8",
  },
  {
    id: "prod_fm_9000_xe",
    category: "Tappvatten",
    manufacturer: "FM Mattsson",
    productName: "FM Mattsson 9000 XE",
    modelName: "9000 XE",
  },
];

const first = parseComponentInput("NIBE F1245-8 8 kW / 180 l, serienr NIBE-1245-1608742, 2016, god", products);
assert.equal(first.length, 1);
assert.equal(first[0]?.typeName, "Värmepump");
assert.equal(first[0]?.brand, "NIBE");
assert.equal(first[0]?.model, "F1245-8");
assert.equal(first[0]?.installedYear, "2016");
assert.equal(first[0]?.serialNo, "NIBE-1245-1608742");
assert.equal(first[0]?.status, "God");
assert.equal(first[0]?.productModelId, "prod_nibe_f1245_8");

const many = parseComponentInput(`ESBE VTA323 blandningsventil 2023
Flamco Prescor B säkerhetsventil 2023
Purus Oden 75 golvbrunn 2018
Grundfos Alpha2 25-60 DN25 180mm 2023
Altech N18 expansionskärl 18 liter 2023`);
assert.equal(many.length, 5);
assert.deepEqual(many.map((row) => row.typeName), [
  "Blandningsventil",
  "Säkerhetsventil",
  "Golvbrunn",
  "Cirkulationspump",
  "Expansionskärl",
]);
assert.equal(many[3]?.systemName, "DN25 / 180mm");

const duplicates = parseComponentInput("2 st FM Mattson 9000xe 2023", products);
assert.equal(duplicates.length, 2);
assert.equal(duplicates[0]?.brand, "FM Mattsson");
assert.equal(duplicates[0]?.model, "9000 XE");
assert.equal(duplicates[0]?.productModelId, "prod_fm_9000_xe");

const table = parseComponentInput("Värmepump\tNIBE F1245-8\t8 kW / 180 l\tNIBE-1245-1608742\t2016\tGod", products);
assert.equal(table.length, 1);
assert.equal(table[0]?.systemName, "8 kW / 180 l");
assert.equal(table[0]?.serialNo, "NIBE-1245-1608742");

const uncertain = parseComponentInput("Nibe värmepump cirka 2016");
assert.equal(uncertain[0]?.installedYear, "2016");
assert.ok(uncertain[0]?.warnings?.some((warning) => warning.includes("ungefärligt")));

console.log("component-input-parser tests passed");
