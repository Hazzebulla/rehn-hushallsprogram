import assert from "node:assert/strict";
import { scoringForReportView, storedScoringFromReportSummary } from "./husstatus-report-snapshot";
import type { HusstatusScoringResult } from "./husstatus-scoring";

const currentScoring = {
  scoringVersion: 2,
  houseScore: 91,
  riskIndex: 12,
  riskLevel: "Låg",
  controlGrade: 88,
  dataSufficient: true,
  counts: { urgent: 0, recommended: 0, watch: 0, passed: 5, unchecked: 0 },
  categoryScores: [],
  componentAssessments: [],
  actions: [],
  riskMatrix: [],
  summary: "Aktuell beräkning",
} satisfies HusstatusScoringResult;

const storedSummary = {
  scoring: {
    scoringVersion: 1,
    houseScore: 64,
    risk: 41,
    riskLevel: "Medel",
    controlGrade: 72,
    sufficientData: true,
    counts: { ok: 2, recommended: 1 },
    categoryScores: [{ label: "Värme", riskIndex: 41 }],
    componentAssessments: [{ component: "Expansionskärl", riskScore: 70 }],
    actions: [{ action: "Byt expansionskärl" }],
    riskMatrix: [{ label: "Expansionskärl", probability: 4, consequence: 3 }],
    summary: "Sparad rapportberäkning",
  },
};

const stored = storedScoringFromReportSummary(storedSummary);
assert.ok(stored);
assert.equal(stored.scoringVersion, 1);
assert.equal(stored.houseScore, 64);
assert.equal(stored.riskIndex, 41);
assert.equal(stored.riskLevel, "Medel");

const selectedReportScoring = scoringForReportView(storedSummary, currentScoring);
assert.equal(selectedReportScoring.houseScore, 64);
assert.equal(selectedReportScoring.riskIndex, 41);

const draftScoring = scoringForReportView({}, currentScoring);
assert.equal(draftScoring.houseScore, 91);
assert.equal(draftScoring.riskIndex, 12);

console.log("husstatus report snapshot tests passed");
