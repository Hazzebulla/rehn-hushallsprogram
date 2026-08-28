import assert from "node:assert/strict";
import { buildHusstatusSummaryEmail } from "./husstatus-summary-email";

const baseInput = {
  customerName: "Kenneth Karlsson",
  recipient: "kenneth@example.se",
  propertyLabel: "Skillinge 694",
  reportPublished: true,
  reportUrl: "https://example.se/rapport/rvm_public_token",
  reportVersion: 3,
  healthScore: 83,
  riskLevel: "Låg",
  riskIndex: 18,
  controlGrade: 96,
  counts: { urgent: 0, recommended: 2, watch: 3, passed: 14 },
  actions: [
    {
      component: "Blandningsventil",
      reason: "Funktionen bör följas upp.",
      recommendedTime: "inom 12 månader",
      costCents: 400000,
    },
  ],
  componentAssessments: [
    {
      component: "Expansionskärl",
      actionNeed: "Bevaka",
      recommendedTime: "1-3 år",
      reasonsNegative: ["Fungerar idag men bör följas upp utifrån ålder."],
    },
  ],
};

const standard = buildHusstatusSummaryEmail(baseInput, "standard");
assert.equal(standard.recipient, "kenneth@example.se");
assert.equal(standard.subject, "Din Husstatus – Skillinge 694");
assert.match(standard.bodyText, /Inga akuta brister identifierades/);
assert.match(standard.bodyText, /Blandningsventil/);
assert.match(standard.bodyText, /https:\/\/example\.se\/rapport\/rvm_public_token/);
assert.doesNotMatch(standard.bodyText, /reportId|\/admin\//);
assert.doesNotMatch(standard.bodyText, /Anna Andersson/);

const unpublished = buildHusstatusSummaryEmail({
  ...baseInput,
  reportPublished: false,
  reportUrl: undefined,
}, "short");
assert.equal(unpublished.reportUrl, undefined);
assert.match(unpublished.bodyText, /inte publicerad/);
assert.doesNotMatch(unpublished.bodyText, /https:\/\/example\.se\/husrapport/);

const detailed = buildHusstatusSummaryEmail(baseInput, "detailed");
assert.ok(detailed.bodyText.length >= standard.bodyText.length);

console.log("husstatus-summary-email tests passed");
