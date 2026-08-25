import { PrismaClient, Role, AuthProvider, DocumentVisibility, BackupStatus } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { starterProducts } from "../lib/product-registry";

const prisma = new PrismaClient();
const seedPassword = process.env.SEED_USER_PASSWORD;

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
      update: {
        userId: user.id,
        companyId: company.id,
        ...(seedPassword ? { passwordHash: hashPassword(seedPassword) } : {}),
      },
      create: {
        companyId: company.id,
        userId: user.id,
        provider: AuthProvider.EMAIL,
        providerAccountId: email,
        passwordHash: hashPassword(seedPassword ?? "demo-password"),
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

  for (const product of starterProducts) {
    const manufacturer = await prisma.manufacturer.upsert({
      where: { name: product.manufacturer },
      update: { website: product.website ?? null },
      create: { name: product.manufacturer, website: product.website ?? null },
    });

    await prisma.productModel.upsert({
      where: {
        manufacturerId_category_modelName: {
          manufacturerId: manufacturer.id,
          category: product.category,
          modelName: product.modelName,
        },
      },
      update: {
        systemType: product.systemType ?? null,
        productionStartYear: product.productionStartYear ?? null,
        productionEndYear: product.productionEndYear ?? null,
        outputMinKw: product.outputMinKw ?? null,
        outputMaxKw: product.outputMaxKw ?? null,
        tankVolumeLitres: product.tankVolumeLitres ?? null,
        connectionSize: product.connectionSize ?? null,
        dimensions: product.dimensions ?? null,
        controlSystem: product.controlSystem ?? null,
        expectedLifetimeMinYears: product.expectedLifetimeMinYears ?? null,
        expectedLifetimeMaxYears: product.expectedLifetimeMaxYears ?? null,
        replacementPriceMinSek: product.replacementPriceMinSek ?? null,
        replacementPriceMaxSek: product.replacementPriceMaxSek ?? null,
        sourceUrl: product.sourceUrl ?? null,
        manualUrl: product.manualUrl ?? null,
        wiringDiagramUrl: product.wiringDiagramUrl ?? null,
        dataQuality: product.dataQuality,
        lastVerifiedAt: new Date(),
        active: true,
      },
      create: {
        manufacturerId: manufacturer.id,
        category: product.category,
        modelName: product.modelName,
        systemType: product.systemType ?? null,
        productionStartYear: product.productionStartYear ?? null,
        productionEndYear: product.productionEndYear ?? null,
        outputMinKw: product.outputMinKw ?? null,
        outputMaxKw: product.outputMaxKw ?? null,
        tankVolumeLitres: product.tankVolumeLitres ?? null,
        connectionSize: product.connectionSize ?? null,
        dimensions: product.dimensions ?? null,
        controlSystem: product.controlSystem ?? null,
        expectedLifetimeMinYears: product.expectedLifetimeMinYears ?? null,
        expectedLifetimeMaxYears: product.expectedLifetimeMaxYears ?? null,
        replacementPriceMinSek: product.replacementPriceMinSek ?? null,
        replacementPriceMaxSek: product.replacementPriceMaxSek ?? null,
        sourceUrl: product.sourceUrl ?? null,
        manualUrl: product.manualUrl ?? null,
        wiringDiagramUrl: product.wiringDiagramUrl ?? null,
        dataQuality: product.dataQuality,
        lastVerifiedAt: new Date(),
        active: true,
      },
    });
  }
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

