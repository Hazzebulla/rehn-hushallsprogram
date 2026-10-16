export type ReportTargetProperty = {
  address: string;
  propertyNo: string | null;
  buildYear: number | null;
  customer: {
    name: string;
    phone: string | null;
    invoiceEmail: string | null;
  };
};

export function reportTargetIdentityAnswers(target: ReportTargetProperty) {
  return {
    customer_name: target.customer.name,
    contact: [target.customer.phone, target.customer.invoiceEmail].filter(Boolean).join(" / "),
    property_address: [target.propertyNo, target.address].filter(Boolean).join(" / "),
    build_year: target.buildYear?.toString() ?? "",
  };
}

export function enforceReportTargetIdentity(
  answers: Record<string, unknown>,
  target: ReportTargetProperty,
): Record<string, unknown> {
  return {
    ...answers,
    ...reportTargetIdentityAnswers(target),
  };
}
