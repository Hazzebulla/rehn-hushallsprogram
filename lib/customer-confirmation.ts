import { clean, fullAddress, fullName, type CustomerPreInspectionPayload } from "./customer-preinspection";

export type CustomerConfirmationDetails = {
  customerName: string;
  address: string;
  submittedAt: string;
  status: "Inskickad";
};

function formatSubmittedAt(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function customerConfirmationDetails(
  payload: CustomerPreInspectionPayload,
  submittedAt?: string | Date | null,
): CustomerConfirmationDetails {
  return {
    customerName: clean(fullName(payload)) || "Ej angivet",
    address: clean(fullAddress(payload)) || "Ej angivet",
    submittedAt: formatSubmittedAt(submittedAt),
    status: "Inskickad",
  };
}
