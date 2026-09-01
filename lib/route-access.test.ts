import assert from "node:assert/strict";
import { isApiRoute, isPublicRoute, requiresSession } from "./route-access";

const publicCustomerRoutes = [
  "/login",
  "/rapport/rvm_public_token_123456789012345678901234",
  "/husrapport/start/customer_token_123456789012345678901234",
];

for (const route of publicCustomerRoutes) {
  assert.equal(isPublicRoute(route), true, `${route} ska vara publik`);
  assert.equal(requiresSession(route), false, `${route} ska inte kräva intern session`);
}

const internalRoutes = [
  "/",
  "/admin",
  "/admin/customers",
  "/dashboard",
  "/kunder",
  "/huscheck",
  "/husrapport",
  "/demo/inspection",
  "/api/admin/reports/report_1/customer-answers",
  "/api/husrapport/export",
  "/api/products",
];

for (const route of internalRoutes) {
  assert.equal(isPublicRoute(route), false, `${route} ska inte vara publik`);
  assert.equal(requiresSession(route), true, `${route} ska kräva intern session`);
}

assert.equal(isApiRoute("/api/products"), true);
assert.equal(isApiRoute("/admin"), false);

console.log("route-access tests passed");
