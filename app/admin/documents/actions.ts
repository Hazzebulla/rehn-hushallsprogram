"use server";

import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export type DocumentVm = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeKb: number;
  visibility: string;
  version: number;
  customerName: string;
  propertyName: string;
  projectNumber: string;
  createdAt: string;
  downloadUrl: string;
};

export type DocumentOption = {
  id: string;
  label: string;
};

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "document.bin";
}

export async function uploadDocumentAction(formData: FormData) {
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const customerId = String(formData.get("customerId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const visibility = String(formData.get("visibility") ?? "INTERNAL");

  if (!(file instanceof File) || file.size === 0 || !title) {
    return { ok: false, message: "Välj fil och ange titel." };
  }

  if (!["INTERNAL", "FIELD_TEAM", "CUSTOMER"].includes(visibility)) {
    return { ok: false, message: "Ogiltig synlighet." };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const checksumSha256 = createHash("sha256").update(bytes).digest("hex");
    const cleanName = safeFileName(file.name);
    const storageKey = `${COMPANY_ID}/${Date.now()}-${cleanName}`;
    const absolutePath = path.join(process.cwd(), "storage", "documents", storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, bytes);

    const document = await prisma.documentAsset.create({
      data: {
        companyId: COMPANY_ID,
        customerId: customerId || null,
        propertyId: propertyId || null,
        projectId: projectId || null,
        title,
        fileName: cleanName,
        mimeType: file.type || "application/octet-stream",
        storageKey,
        checksumSha256,
        sizeBytes: file.size,
        visibility: visibility as "INTERNAL" | "FIELD_TEAM" | "CUSTOMER",
        uploadedById: DEMO_ACTOR_ID,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: COMPANY_ID,
        actorId: DEMO_ACTOR_ID,
        action: "UPLOAD_DOCUMENT",
        entity: "DocumentAsset",
        entityId: document.id,
        after: {
          title,
          fileName: cleanName,
          visibility,
          customerId: customerId || null,
          propertyId: propertyId || null,
          projectId: projectId || null,
          checksumSha256,
        },
      },
    });

    revalidatePath("/admin");
    revalidatePath("/admin/documents");
    revalidatePath("/portal");

    return { ok: true, message: "Dokumentet sparades och metadata loggades." };
  } catch {
    return { ok: false, message: "Dokumentet kunde inte sparas." };
  }
}

export async function setDocumentVisibilityAction(documentId: string, visibility: "INTERNAL" | "FIELD_TEAM" | "CUSTOMER") {
  try {
    const document = await prisma.documentAsset.findFirst({
      where: { id: documentId, companyId: COMPANY_ID },
    });

    if (!document) {
      return { ok: false, message: "Dokumentet finns inte i databasen." };
    }

    await prisma.$transaction([
      prisma.documentAsset.update({
        where: { id: document.id },
        data: { visibility },
      }),
      prisma.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          actorId: DEMO_ACTOR_ID,
          action: "SET_DOCUMENT_VISIBILITY",
          entity: "DocumentAsset",
          entityId: document.id,
          before: { visibility: document.visibility },
          after: { visibility },
        },
      }),
    ]);

    revalidatePath("/admin/documents");
    revalidatePath("/portal");
    return { ok: true, message: "Dokumentsynlighet uppdaterades." };
  } catch {
    return { ok: false, message: "Databasen är inte nåbar. Synlighet kunde inte sparas." };
  }
}
