import assert from "node:assert/strict";
import test from "node:test";
import { enforceReportTargetIdentity } from "./report-target-identity";

test("selected property identity replaces stale customer fields without changing inspection data", () => {
  const answers = enforceReportTargetIdentity(
    {
      customer_name: "Andreas Lindberg",
      property_address: "Prästgatan 11",
      overall_status: "God",
      kitchen_photos: [{ id: "photo-1" }],
    },
    {
      propertyNo: "Tackelvägen 1",
      address: "Tackelvägen 1, 86531, Sundsvall",
      buildYear: 1984,
      customer: {
        name: "Ricardo Ezzelini",
        phone: "070-000 00 00",
        invoiceEmail: "ricardo@example.se",
      },
    },
  );

  assert.equal(answers.customer_name, "Ricardo Ezzelini");
  assert.equal(answers.contact, "070-000 00 00 / ricardo@example.se");
  assert.equal(answers.property_address, "Tackelvägen 1 / Tackelvägen 1, 86531, Sundsvall");
  assert.equal(answers.build_year, "1984");
  assert.equal(answers.overall_status, "God");
  assert.deepEqual(answers.kitchen_photos, [{ id: "photo-1" }]);
});
