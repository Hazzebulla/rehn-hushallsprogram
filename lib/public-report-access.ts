import { randomBytes } from "crypto";

const PUBLIC_TOKEN_PREFIX = "rvm_";
const PUBLISHED_STATUSES = new Set(["published", "PUBLISHED"]);

export function createPublicReportToken() {
  return `${PUBLIC_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function isPublishedReportStatus(status: string | null | undefined) {
  return PUBLISHED_STATUSES.has(String(status ?? ""));
}

export function publicReportPath(token: string | null | undefined) {
  return token ? `/rapport/${encodeURIComponent(token)}` : "";
}

export function publicReportUrl(origin: string, token: string | null | undefined) {
  const path = publicReportPath(token);
  if (!path) return "";
  return `${origin.replace(/\/$/, "")}${path}`;
}
