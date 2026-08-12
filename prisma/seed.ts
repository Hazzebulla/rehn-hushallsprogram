import { PrismaClient, Role, AuthProvider, DocumentVisibility, BackupStatus } from "@prisma/client";
import { hashPassword } from "../lib/password";

const prisma = new PrismaClient();
const demoPassword = process.env.SEED_USER_PASSWORD ?? "demo-password";

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "org_rehn_vvs" },
    update: {
      name: "Rehn VVS & Montage i Timrå AB",
      orgNo: "559000-0000",
    },
    create: {
      id: "org_rehn_vvs",
      name: "Rehn VVS & Montage i Timrå AB",
      orgNo: "559000-0000",
    },
  });

  const users = [
    ["usr_info_rehn", "Rehn VVS & Montage", "info@rehnvvsmontage.se", Role.ADMIN],
    ["usr_admin_rehn", "Admin Rehn", "admin@rehnvvs.se", Role.ADMIN],
    ["usr_supervisor_rehn", "Arbetsledare Rehn", "arbetsledare@rehnvvs.se", Role.SUPERVISOR],
    ["usr_worker_rehn", "Montör Rehn", "montor@rehnvvs.se", Role.WORKER],
    ["usr_customer_svensson", "Anna Svensson", "anna.svensson@example.se", Role.CUSTOMER],
  ] as const;

  for (const [id, name, email, role] of users) {
    const user = await prisma.user.upsert({
      where: { companyId_email: { companyId: company.id, email } },
      update: { name, role, active: true },
      create: { id, companyId: company.id, name, email, role, active: true },
    });

    await prisma.authAccount.upsert({
      where: { provider_providerAccountId: { provider: AuthProvider.EMAIL, providerAccountId: email } },
      update: { userId: user.id, companyId: company.id, passwordHash: hashPassword(demoPassword) },
      create: {
        companyId: company.id,
        userId: user.id,
        provider: AuthProvider.EMAIL,
        providerAccountId: email,
        passwordHash: hashPassword(demoPassword),
        mfaEnabled: role === Role.ADMIN,
      },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: "cust_svensson_angby" },
    update: {
      name: "Anna & Erik Svensson",
      invoiceEmail: "anna.svensson@example.se",
      phone: "070-123 45 67",
    },
    create: {
      id: "cust_svensson_angby",
      companyId: company.id,
      type: "PRIVATE",
      name: "Anna & Erik Svensson",
      orgOrPersonNo: "19780505-1234",
      invoiceEmail: "anna.svensson@example.se",
      phone: "070-123 45 67",
    },
  });

  await prisma.customerPortalAccount.upsert({
    where: { customerId: customer.id },
    update: { email: "anna.svensson@example.se", active: true },
    create: {
      companyId: company.id,
      customerId: customer.id,
      email: "anna.svensson@example.se",
      active: true,
    },
  });

  const property = await prisma.property.upsert({
    where: { id: "prop_villa_angby" },
    update: {
      address: "Björkvägen 12, Bromma",
      buildYear: 1978,
    },
    create: {
      id: "prop_villa_angby",
      companyId: company.id,
      customerId: customer.id,
      propertyNo: "ÄNGBY 12:4",
      type: "Villa",
      address: "Björkvägen 12, Bromma",
      buildYear: 1978,
    },
  });

  await prisma.documentAsset.upsert({
    where: { id: "doc_husrapport_demo" },
    update: {
      visibility: DocumentVisibility.CUSTOMER,
      version: 1,
    },
    create: {
      id: "doc_husrapport_demo",
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      title: "RVM Husstatus Premium Rapport",
      fileName: "rvm-husstatus-premium-rapport.pdf",
      mimeType: "application/pdf",
      storageKey: "demo/rehn-vvs/prop_villa_angby/rvm-husstatus.pdf",
      checksumSha256: "demo-checksum-replace-after-upload",
      sizeBytes: 2048000,
      visibility: DocumentVisibility.CUSTOMER,
      version: 1,
    },
  });

  await prisma.backupJob.create({
    data: {
      companyId: company.id,
      status: BackupStatus.QUEUED,
      scope: "DATABASE_AND_DOCUMENTS",
    },
  });

  await prisma.auditLog.create({
    data: {
      companyId: company.id,
      actorId: "usr_admin_rehn",
      action: "SEED_FOUNDATION",
      entity: "Company",
      entityId: company.id,
      after: { phase: "foundation", customerId: customer.id, propertyId: property.id },
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

