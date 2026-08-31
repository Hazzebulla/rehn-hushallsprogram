import assert from "node:assert/strict";
import {
  buildCustomerSelfDeclaration,
  customerDeclarationStats,
  groupedCustomerAnswersFromDeclaration,
  legacyCustomerGroupsFromMappedAnswers,
} from "./huscheck-customer-answers";

const declaration = buildCustomerSelfDeclaration({
  firstName: "Anna",
  lastName: "Andersson",
  phone: "070-123 45 67",
  email: "anna@example.se",
  address: "Testvägen 1",
  postalCode: "861 00",
  city: "Timrå",
  propertyType: "Villa",
  buildYear: "1974",
  livingArea: "142",
  floors: "2",
  heating: ["Bergvärme", "Radiatorer"],
  heatPumpBrand: "NIBE",
  heatPumpModel: "F1245-8",
  heatPumpYear: "2016",
  heatPumpWorks: "Ja",
  heatPumpAlarms: "Inga larm",
  heatPumpService: "",
  heatPumpPhotos: [{ id: "photo-1", name: "typplat.jpg", mimeType: "image/jpeg", size: 1200, dataUrl: "data:image/jpeg;base64,abc", createdAt: "2026-08-31T09:00:00.000Z" }],
  hotWaterType: "Varmvatten via värmepump",
  heatDistribution: "Radiatorer",
  radiatorsWarm: "Nej",
  coldRadiators: "Två radiatorer på övervåningen",
  valvesChanged: "Vet inte",
  problems: ["Läckage", "Lågt vattentryck"],
  problemDescription: "Köksavloppet har varit segt flera gånger.",
  recentWork: "Ja",
  recentWorkDescription: "Blandare bytt 2024",
  otherPhotos: [],
}, new Date("2026-08-31T09:42:00.000Z"));

assert.equal(declaration.submittedAt, "2026-08-31T09:42:00.000Z");
assert.ok(declaration.answers.length >= 39);
assert.equal(declaration.answers.find((answer) => answer.questionId === "buildYear")?.questionLabel, "Byggår");
assert.equal(declaration.answers.find((answer) => answer.questionId === "heatPumpPhotos")?.answerType, "photo");
assert.equal(declaration.answers.find((answer) => answer.questionId === "heatPumpPhotos")?.answer instanceof Array, true);
assert.equal(JSON.stringify(declaration.answers).includes("data:image/jpeg"), false);

const stats = customerDeclarationStats(declaration);
assert.equal(stats.answeredQuestions, declaration.answeredQuestions);
assert.equal(stats.totalQuestions, declaration.totalQuestions);
assert.equal(stats.imageCount, 1);
assert.ok(stats.highlights.some((highlight) => /Läckage/.test(highlight.text)));
assert.ok(stats.highlights.some((highlight) => /Lågt vattentryck/.test(highlight.text)));

const groups = groupedCustomerAnswersFromDeclaration(declaration);
assert.ok(groups.some((group) => group.title === "Värmesystem"));
assert.ok(groups.some((group) => group.title === "Kundens önskemål"));
const heatPumpGroup = groups.find((group) => group.title === "Värmepump");
assert.ok(heatPumpGroup);
assert.equal(heatPumpGroup.items.find((item) => item.key === "heatPumpService")?.value, "Ej besvarat");
assert.equal(heatPumpGroup.items.find((item) => item.key === "heatPumpService")?.answered, false);

const legacyGroups = legacyCustomerGroupsFromMappedAnswers({
  customer_name: "Anna Andersson",
  heat_source_type: "Bergvärme",
  observations: "Kontrollera expansionskärlet",
});
assert.equal(legacyGroups.find((group) => group.title === "Kunduppgifter")?.items.find((item) => item.key === "customer_name")?.value, "Anna Andersson");
assert.equal(legacyGroups.find((group) => group.title === "Fastigheten")?.items.find((item) => item.key === "build_year")?.value, "Ej besvarat");

console.log("huscheck customer answer tests passed");
