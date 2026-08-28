import assert from "node:assert/strict";
import { calculateHusstatusScore, type ScoringComponentInput } from "./husstatus-scoring";

const baseAnswers = {
  customer_name: "Testkund",
  property_address: "Testvägen 1",
  scope: "Full husstatus",
  overall_status: "God",
  rvm_signer: "Montör",
  supply_temp_c: "35",
  return_temp_c: "31",
  nearest_tap_c: "52",
  furthest_tap_c: "50",
};

function score(answers: Record<string, unknown>, components: ScoringComponentInput[]) {
  return calculateHusstatusScore(answers, components, { currentYear: 2026, totalControlPoints: 30 });
}

const propertyA = score(baseAnswers, [
  { typeName: "Värmepump", category: "Värmesystem", brand: "NIBE", model: "S1255", installedYear: "2023", status: "God", replacementCostCents: 0 },
  { typeName: "Blandningsventil", category: "Tappvatten", brand: "ESBE", model: "VTA323", installedYear: "2023", status: "God", replacementCostCents: 0 },
  { typeName: "Säkerhetsventil", category: "Säkerhetsfunktioner", brand: "Flamco", model: "Prescor B", installedYear: "2023", status: "God", replacementCostCents: 0 },
]);
assert.ok(propertyA.houseScore >= 84);
assert.equal(propertyA.riskLevel, "Låg");
assert.equal(propertyA.counts.urgent, 0);

const propertyB = score(baseAnswers, [
  { typeName: "Värmepump", category: "Värmesystem", brand: "NIBE", model: "F1245", installedYear: "2008", status: "God", replacementCostCents: 16000000 },
  { typeName: "Expansionskärl", category: "Värmesystem", brand: "Reflex", model: "N18", installedYear: "2010", status: "Bra", replacementCostCents: 750000 },
  { typeName: "Blandningsventil", category: "Tappvatten", brand: "ESBE", model: "VTA322", installedYear: "2011", status: "Bra", replacementCostCents: 350000 },
]);
assert.ok(propertyB.houseScore >= 78);
assert.ok(propertyB.riskIndex > propertyA.riskIndex);
assert.equal(propertyB.counts.urgent, 0);
assert.ok(propertyB.counts.watch >= 1);
assert.ok(
  propertyB.componentAssessments.some((item) => item.actionNeed === "Planera underhåll" || item.actionNeed === "Planera byte"),
);
assert.ok(propertyB.componentAssessments.every((item) => item.conditionScore >= 85));

const propertyC = score(
  { ...baseAnswers, safety_valve: "Säkerhetsventil fungerar inte", leak_notes: "Aktivt läckage vid koppling" },
  [
    { typeName: "Värmepump", category: "Värmesystem", brand: "NIBE", model: "S1255", installedYear: "2023", status: "God", replacementCostCents: 0 },
    { typeName: "Säkerhetsventil", category: "Säkerhetsfunktioner", brand: "Flamco", model: "Prescor B", installedYear: "2023", status: "Ej fungerande läckage", replacementCostCents: 450000 },
  ],
);
assert.ok(propertyC.riskIndex > propertyB.riskIndex);
assert.ok(propertyC.counts.urgent + propertyC.counts.recommended >= 1);
assert.ok(propertyC.houseScore < propertyA.houseScore);

const propertyD = score(
  {
    customer_name: "Testkund",
    property_address: "Testvägen 2",
    scope: "Begränsad kontroll",
    heat_source_type: "Ej kontrollerat",
    water_source: "Ej åtkomligt",
    sewer_type: "Okänt",
    rvm_signer: "Montör",
  },
  [
    { typeName: "Värmepump", category: "Värmesystem", brand: "NIBE", model: "", installedYear: null, status: "Ej kontrollerat" },
  ],
);
assert.ok(propertyD.controlGrade < propertyA.controlGrade);
assert.ok(propertyD.houseScore >= 55 || propertyD.houseScore === 0);
assert.equal(propertyD.counts.urgent, 0);
assert.ok(propertyD.counts.unchecked >= 1);
assert.ok(propertyD.componentAssessments.every((item) => item.actionNeed !== "Akut åtgärd"));

assert.notEqual(propertyA.houseScore, propertyB.houseScore);
assert.notEqual(propertyB.riskIndex, propertyC.riskIndex);
assert.notEqual(propertyA.riskIndex, 100 - propertyA.houseScore);

console.log("husstatus-scoring tests passed");
