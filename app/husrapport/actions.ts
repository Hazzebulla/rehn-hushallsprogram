"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";
import { getCurrentSessionUser } from "../../lib/session";
import { createPublicReportToken } from "../../lib/public-report-access";

const COMPANY_ID = "org_rehn_vvs";

export async function updateHouseReportStatusAction(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!reportId || !["APPROVED", "PUBLISHED", "ARCHIVED"].includes(status)) {
    return;
  }

  const session = await getCurrentSessionUser();
  if (!session || session.companyId !== COMPANY_ID || session.role === "CUSTOMER") return;

  const existing = await prisma.houseReport.findFirst({
    where: { id: reportId, companyId: COMPANY_ID },
    select: { id: true, publicAccessToken: true },
  });
  if (!existing) return;

  const now = new Date();
  await prisma.houseReport.update({
    where: { id: reportId },
    data: {
      status,
      reviewedAt: status === "APPROVED" ? now : undefined,
      publishedAt: status === "PUBLISHED" ? now : undefined,
      publicAccessEnabled: status === "PUBLISHED",
      publicAccessToken: status === "PUBLISHED" ? existing.publicAccessToken ?? createPublicReportToken() : undefined,
      publicTokenCreatedAt: status === "PUBLISHED" && !existing.publicAccessToken ? now : undefined,
      archivedAt: status === "ARCHIVED" ? now : undefined,
    },
  });

  revalidatePath("/husrapport");
  revalidatePath("/portal");
}
