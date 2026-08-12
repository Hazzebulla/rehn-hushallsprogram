"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";

export async function updateHouseReportStatusAction(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!reportId || !["APPROVED", "PUBLISHED", "ARCHIVED"].includes(status)) {
    return;
  }

  const now = new Date();
  await prisma.houseReport.update({
    where: { id: reportId },
    data: {
      status,
      reviewedAt: status === "APPROVED" ? now : undefined,
      publishedAt: status === "PUBLISHED" ? now : undefined,
      archivedAt: status === "ARCHIVED" ? now : undefined,
    },
  });

  revalidatePath("/husrapport");
  revalidatePath("/portal");
}
