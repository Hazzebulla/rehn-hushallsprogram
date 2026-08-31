import type { HusstatusScoringResult, ScoringRiskLevel } from "./husstatus-scoring";

export type StoredHusstatusScoring = Omit<
  Pick<
    HusstatusScoringResult,
    | "houseScore"
    | "riskIndex"
    | "riskLevel"
    | "controlGrade"
    | "dataSufficient"
    | "counts"
    | "categoryScores"
    | "componentAssessments"
    | "actions"
    | "riskMatrix"
    | "summary"
  >,
  never
> & {
  scoringVersion: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function arrayOrEmpty<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function riskLevelOrDefault(value: unknown): ScoringRiskLevel {
  return value === "Låg" || value === "Medel" || value === "Hög" || value === "Kritisk" ? value : "Medel";
}

export function storedScoringFromReportSummary(summary: unknown): StoredHusstatusScoring | null {
  const scoring = asRecord(asRecord(summary).scoring);
  const scoringVersion = numberOrUndefined(scoring.scoringVersion);
  const houseScore = numberOrUndefined(scoring.houseScore);
  const riskIndex = numberOrUndefined(scoring.risk);
  const controlGrade = numberOrUndefined(scoring.controlGrade);

  if (!scoringVersion || houseScore === undefined || riskIndex === undefined || controlGrade === undefined) {
    return null;
  }

  return {
    scoringVersion,
    houseScore,
    riskIndex,
    riskLevel: riskLevelOrDefault(scoring.riskLevel),
    controlGrade,
    dataSufficient: scoring.sufficientData !== false,
    counts: asRecord(scoring.counts) as StoredHusstatusScoring["counts"],
    categoryScores: arrayOrEmpty<StoredHusstatusScoring["categoryScores"][number]>(scoring.categoryScores),
    componentAssessments: arrayOrEmpty<StoredHusstatusScoring["componentAssessments"][number]>(scoring.componentAssessments),
    actions: arrayOrEmpty<StoredHusstatusScoring["actions"][number]>(scoring.actions),
    riskMatrix: arrayOrEmpty<StoredHusstatusScoring["riskMatrix"][number]>(scoring.riskMatrix),
    summary: String(scoring.summary ?? ""),
  };
}

export function scoringForReportView(
  selectedReportSummary: unknown,
  currentScoring: HusstatusScoringResult,
) {
  return storedScoringFromReportSummary(selectedReportSummary) ?? currentScoring;
}
