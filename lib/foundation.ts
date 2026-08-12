export type FoundationRole = "ADMIN" | "SUPERVISOR" | "WORKER" | "CUSTOMER";

export const rehnVvsOrganization = {
  id: "org_rehn_vvs",
  name: "Rehn VVS & Montage i Timrå AB",
  orgNo: "559000-0000",
  tenantKey: "rehn-vvs",
};

export const roleMatrix: Record<FoundationRole, string[]> = {
  ADMIN: [
    "manage_company",
    "manage_users",
    "manage_customers",
    "manage_properties",
    "publish_portal",
    "manage_documents",
    "manage_gdpr",
    "view_audit_log",
  ],
  SUPERVISOR: [
    "view_customers",
    "manage_properties",
    "manage_work_orders",
    "approve_time",
    "upload_documents",
    "view_audit_log_limited",
  ],
  WORKER: [
    "view_assigned_work",
    "submit_inspection",
    "upload_field_images",
    "submit_time",
  ],
  CUSTOMER: [
    "view_own_portal",
    "view_published_documents",
    "submit_customer_request",
    "request_gdpr_export",
  ],
};

export const foundationChecklist = [
  { area: "Säker inloggning", status: "Aktiv demo", detail: "Login skapar AuthSession med hashad cookie-token, utgångstid och revocation." },
  { area: "Organisation", status: "Definierad", detail: "Rehn VVS är första tenant och all data scopeas med companyId." },
  { area: "Roller", status: "Definierad", detail: "Admin, arbetsledare, montör och kund med separat behörighetsmatris." },
  { area: "Kundregister", status: "Demo finns", detail: "Kunder kan skapas i admin och kopplas till fastighetsjournal." },
  { area: "Fastighetsregister", status: "Modellerad", detail: "Property, Building, Unit, Room och TechnicalSystem finns i schema." },
  { area: "Databas", status: "Aktiv demo", detail: "SQLite + Prisma sparar data lokalt i prisma/dev.db." },
  { area: "Dokument/bildlagring", status: "Aktiv demo", detail: "DocumentAsset har storageKey, checksum, version och synlighet." },
  { area: "Historik", status: "Aktiv demo", detail: "AuditLog sparar actor, entity, before/after och IP." },
  { area: "Backup", status: "Aktiv demo", detail: "BackupJob spårar körningar, checksum och fel." },
  { area: "GDPR", status: "Aktiv demo", detail: "GdprRequest hanterar export, radering och rättning." },
];
