import assert from "node:assert/strict";
import { nextSequentialReportNo } from "./report-number";

assert.equal(
  nextSequentialReportNo(2026, [
    "RVM-HS-2026-0001",
    "RVM-HS-2026-0002",
    "RVM-HS-2026-0004",
    "RVM-HS-2026-0005",
  ]),
  "RVM-HS-2026-0006",
);

assert.equal(nextSequentialReportNo(2026, []), "RVM-HS-2026-0001");
assert.equal(
  nextSequentialReportNo(2026, ["RVM-HS-2025-0042", "annat-format", "RVM-HS-2026-0009"]),
  "RVM-HS-2026-0010",
);
