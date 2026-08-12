import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getCurrentSessionUser } from "../../../../lib/session";

const COMPANY_ID = "org_rehn_vvs";

function rawAnswerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as { value?: unknown; values?: unknown };
  return record.value ?? record.values ?? value;
}

function stripImagePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripImagePayload);
  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;
  if (typeof record.dataUrl === "string" && typeof record.mimeType === "string") {
    return {
      ...record,
      dataUrl: "[image-data-removed-from-export]",
    };
  }

  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, stripImagePayload(item)]));
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSessionUser();
  if (!session) {
    return NextResponse.json({ message: "Logga in för att exportera data." }, { status: 401 });
  }

  const propertyId = request.nextUrl.searchParams.get("propertyId") ?? undefined;
  const property = await prisma.property.findFirst({
    where: propertyId ? { id: propertyId, companyId: COMPANY_ID } : { companyId: COMPANY_ID },
    include: {
      customer: true,
      healthScore: true,
      components: {
        include: { type: true, system: true },
        orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
      },
      inspections: {
        orderBy: { performedAt: "desc" },
        include: {
          submissions: {
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            include: { answers: true, version: { include: { template: true } } },
          },
        },
      },
      houseReports: {
        orderBy: { generatedAt: "desc" },
      },
      documents: true,
    },
  });

  if (!property) {
    return NextResponse.json({ message: "Fastighet saknas." }, { status: 404 });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: { id: session.id, email: session.email, role: session.role },
    customer: property.customer,
    property: {
      id: property.id,
      propertyNo: property.propertyNo,
      type: property.type,
      address: property.address,
      buildYear: property.buildYear,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
    },
    healthScore: property.healthScore,
    components: property.components,
    inspections: property.inspections.map((inspection) => ({
      ...inspection,
      submissions: inspection.submissions.map((submission) => ({
        ...submission,
        answers: submission.answers.map((answer) => ({
          fieldKey: answer.fieldKey,
          value: stripImagePayload(rawAnswerValue(answer.value)),
        })),
      })),
    })),
    reports: property.houseReports,
    documents: property.documents,
  };

  const fileName = `rvm-husrapport-data-${property.propertyNo ?? property.id}.json`
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .toLowerCase();

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
