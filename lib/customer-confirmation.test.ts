import assert from "node:assert/strict";
import { emptyCustomerPreInspectionPayload } from "./customer-preinspection";
import { customerConfirmationDetails } from "./customer-confirmation";

const details = customerConfirmationDetails({
  ...emptyCustomerPreInspectionPayload,
  firstName: "Anna",
  lastName: "Andersson",
  address: "Testvägen 1",
  postalCode: "861 32",
  city: "Timrå",
}, "2026-08-21T12:32:00.000Z");

assert.equal(details.customerName, "Anna Andersson");
assert.equal(details.address, "Testvägen 1, 861 32, Timrå");
assert.equal(details.status, "Inskickad");
assert.match(details.submittedAt, /2026/);

const fallback = customerConfirmationDetails(emptyCustomerPreInspectionPayload);
assert.equal(fallback.customerName, "Ej angivet");
assert.equal(fallback.address, "Ej angivet");
assert.equal(fallback.submittedAt, "");

console.log("customer-confirmation tests passed");
