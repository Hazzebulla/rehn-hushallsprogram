import assert from "node:assert/strict";
import {
  createPublicReportToken,
  isPublishedReportStatus,
  publicReportPath,
  publicReportUrl,
} from "./public-report-access";

const tokenA = createPublicReportToken();
const tokenB = createPublicReportToken();

assert.match(tokenA, /^rvm_[A-Za-z0-9_-]{40,}$/);
assert.notEqual(tokenA, tokenB);
assert.equal(isPublishedReportStatus("PUBLISHED"), true);
assert.equal(isPublishedReportStatus("published"), true);
assert.equal(isPublishedReportStatus("READY_FOR_REVIEW"), false);
assert.equal(isPublishedReportStatus("ARCHIVED"), false);
assert.equal(publicReportPath(tokenA), `/rapport/${encodeURIComponent(tokenA)}`);
assert.equal(publicReportUrl("https://example.se/", tokenA), `https://example.se/rapport/${encodeURIComponent(tokenA)}`);

console.log("public-report-access tests passed");
