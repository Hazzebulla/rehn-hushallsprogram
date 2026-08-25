export const houseReportStatuses = [
  "customer_form_started",
  "customer_form_completed",
  "visit_scheduled",
  "inspection_in_progress",
  "review_required",
  "published",
  "archived",
] as const;

export type HouseReportStatus = (typeof houseReportStatuses)[number];

export const houseReportStatusLabels: Record<HouseReportStatus, string> = {
  customer_form_started: "Kundformulär påbörjat",
  customer_form_completed: "Kundformulär klart",
  visit_scheduled: "Besök bokat",
  inspection_in_progress: "Pågående besiktning",
  review_required: "Väntar på granskning",
  published: "Publicerad",
  archived: "Arkiverad",
};

export function normalizeHouseReportStatus(status?: string | null): HouseReportStatus {
  const normalized = String(status ?? "").toLowerCase();
  if (houseReportStatuses.includes(normalized as HouseReportStatus)) return normalized as HouseReportStatus;
  if (normalized === "ready_for_review" || normalized === "draft" || normalized === "submitted") return "review_required";
  if (normalized === "published") return "published";
  if (normalized === "archived") return "archived";
  return "inspection_in_progress";
}

export function houseReportStatusLabel(status?: string | null) {
  return houseReportStatusLabels[normalizeHouseReportStatus(status)];
}
