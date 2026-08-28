import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "crypto";
import { prisma } from "../../../../../../lib/prisma";
import { getCurrentSessionUser } from "../../../../../../lib/session";
import {
  buildHusstatusSummaryEmail,
  renderHusstatusSummaryEmailHtml,
  type MailTemplateVariant,
} from "../../../../../../lib/husstatus-summary-email";

const COMPANY_ID = "org_rehn_vvs";

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function appOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  return vercel || request.nextUrl.origin;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function messageKey(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 24);
}

async function buildPdfAttachment(request: NextRequest, report: NonNullable<Awaited<ReturnType<typeof loadReport>>>) {
  const response = await fetch(`${appOrigin(request)}/api/husrapport/form-data-pdf?propertyId=${encodeURIComponent(report.propertyId)}`, {
    cache: "no-store",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
  });
  if (!response.ok) throw new Error("PDF-bilagan kunde inte skapas.");
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    filename: `husstatus-${report.property.propertyNo || report.propertyId}.pdf`.replace(/[^\w.-]+/g, "-"),
    content: buffer.toString("base64"),
  };
}

async function loadReport(reportId: string) {
  return prisma.houseReport.findFirst({
    where: { id: reportId, companyId: COMPANY_ID },
    include: {
      property: {
        include: {
          customer: true,
          healthScore: true,
        },
      },
      mailLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });
}

function templateFrom(value: unknown): MailTemplateVariant {
  return value === "short" || value === "detailed" ? value : "standard";
}

function buildDraft(request: NextRequest, report: NonNullable<Awaited<ReturnType<typeof loadReport>>>, template: MailTemplateVariant, includeReportLink = true) {
  const explanation = asRecord(report.property.healthScore?.explanation);
  const counts = asRecord(explanation.counts);
  const propertyLabel = report.property.propertyNo || report.property.address;
  const reportPublished = report.status === "PUBLISHED" || report.status === "published";
  const reportUrl = reportPublished && includeReportLink ? `${appOrigin(request)}/husrapport?reportId=${report.id}` : undefined;
  return buildHusstatusSummaryEmail({
    customerName: report.property.customer.name,
    recipient: report.property.customer.invoiceEmail ?? "",
    propertyLabel,
    reportUrl,
    reportPublished,
    reportVersion: report.reportVersion,
    healthScore: report.property.healthScore?.score ?? null,
    riskLevel: typeof explanation.riskLevel === "string" ? explanation.riskLevel : null,
    riskIndex: typeof explanation.risk === "number" ? explanation.risk : null,
    controlGrade: typeof explanation.controlGrade === "number" ? explanation.controlGrade : null,
    counts: {
      urgent: Number(counts.urgent ?? 0),
      recommended: Number(counts.recommended ?? 0),
      watch: Number(counts.watch ?? 0),
      passed: Number(counts.passed ?? 0),
    },
    actions: Array.isArray(explanation.actions) ? explanation.actions as Parameters<typeof buildHusstatusSummaryEmail>[0]["actions"] : [],
    componentAssessments: Array.isArray(explanation.componentAssessments)
      ? explanation.componentAssessments as Parameters<typeof buildHusstatusSummaryEmail>[0]["componentAssessments"]
      : [],
  }, template);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getCurrentSessionUser();
  if (!session || session.companyId !== COMPANY_ID || session.role === "CUSTOMER") {
    return NextResponse.json({ message: "Åtkomst nekad." }, { status: 403 });
  }

  const { reportId } = await context.params;
  const report = await loadReport(reportId);
  if (!report) return NextResponse.json({ message: "Rapport saknas." }, { status: 404 });

  const template = templateFrom(request.nextUrl.searchParams.get("template"));
  const draft = buildDraft(request, report, template);
  return NextResponse.json({
    ...draft,
    customerName: report.property.customer.name,
    propertyLabel: report.property.propertyNo || report.property.address,
    reportStatus: report.status,
    latestMail: report.mailLogs[0]
      ? {
          sentAt: report.mailLogs[0].sentAt?.toISOString() ?? null,
          createdAt: report.mailLogs[0].createdAt.toISOString(),
          status: report.mailLogs[0].status,
          subject: report.mailLogs[0].subject,
          reportVersion: report.mailLogs[0].reportVersion,
          changedSinceLastSend: Boolean(report.mailLogs[0].reportVersion && report.mailLogs[0].reportVersion !== report.reportVersion),
        }
      : null,
    pdfAvailable: true,
    pdfUrl: `${appOrigin(request)}/api/husrapport/form-data-pdf?propertyId=${report.propertyId}`,
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getCurrentSessionUser();
  if (!session || session.companyId !== COMPANY_ID || session.role === "CUSTOMER") {
    return NextResponse.json({ message: "Åtkomst nekad." }, { status: 403 });
  }

  const { reportId } = await context.params;
  const report = await loadReport(reportId);
  if (!report) return NextResponse.json({ message: "Rapport saknas." }, { status: 404 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action === "send" ? "send" : "draft";
  const template = templateFrom(body.template);
  const includeReportLink = body.includeReportLink !== false;
  const attachPdf = body.attachPdf === true;
  const generated = buildDraft(request, report, template, includeReportLink);
  const recipient = String(body.recipient ?? generated.recipient).trim().toLowerCase();
  const subject = String(body.subject ?? generated.subject).trim();
  const bodyText = String(body.bodyText ?? generated.bodyText).trim();
  const bodyHtml = renderHusstatusSummaryEmailHtml({
    bodyText,
    propertyLabel: report.property.propertyNo || report.property.address,
    reportUrl: generated.reportUrl,
  });

  if (!isValidEmail(recipient)) {
    return NextResponse.json({ message: "Ange en giltig mottagaradress." }, { status: 400 });
  }
  if (!subject || !bodyText) {
    return NextResponse.json({ message: "Ämne och mailtext krävs." }, { status: 400 });
  }

  if (action === "draft") {
    const log = await prisma.customerMailLog.create({
      data: {
        companyId: COMPANY_ID,
        customerId: report.property.customerId,
        propertyId: report.propertyId,
        reportId: report.id,
        recipient,
        subject,
        bodyText,
        bodyHtml,
        template,
        reportVersion: report.reportVersion,
        status: "DRAFT",
        sentBy: session.email,
      },
    });
    return NextResponse.json({ ok: true, status: log.status, message: "Utkast sparat i mailhistoriken." });
  }

  if (!process.env.RESEND_API_KEY) {
    const log = await prisma.customerMailLog.create({
      data: {
        companyId: COMPANY_ID,
        customerId: report.property.customerId,
        propertyId: report.propertyId,
        reportId: report.id,
        recipient,
        subject,
        bodyText,
        bodyHtml,
        template,
        reportVersion: report.reportVersion,
        status: "PROVIDER_MISSING",
        sentBy: session.email,
      },
    });
    return NextResponse.json({
      ok: false,
      status: log.status,
      message: "Mailprovider saknas. Lägg in RESEND_API_KEY i Vercel för att kunna skicka riktiga mail.",
    }, { status: 503 });
  }

  let attachments: Array<{ filename: string; content: string }> | undefined;
  try {
    attachments = attachPdf ? [await buildPdfAttachment(request, report)] : undefined;
  } catch (error) {
    const log = await prisma.customerMailLog.create({
      data: {
        companyId: COMPANY_ID,
        customerId: report.property.customerId,
        propertyId: report.propertyId,
        reportId: report.id,
        recipient,
        subject,
        bodyText,
        bodyHtml,
        template,
        reportVersion: report.reportVersion,
        status: "PDF_FAILED",
        sentBy: session.email,
      },
    });
    return NextResponse.json({ ok: false, status: log.status, message: error instanceof Error ? error.message : "PDF-bilagan kunde inte skapas." }, { status: 502 });
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `husstatus-summary-${messageKey([report.id, String(report.reportVersion), recipient, subject, bodyText])}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Rehn VVS <onboarding@resend.dev>",
      to: [recipient],
      subject,
      html: bodyHtml,
      text: bodyText,
      attachments,
    }),
  });
  const resendPayload = await resendResponse.json().catch(() => ({})) as { id?: string; message?: string };
  const sent = resendResponse.ok;
  const log = await prisma.customerMailLog.create({
    data: {
      companyId: COMPANY_ID,
      customerId: report.property.customerId,
      propertyId: report.propertyId,
      reportId: report.id,
      recipient,
      subject,
      bodyText,
      bodyHtml,
      template,
      reportVersion: report.reportVersion,
      status: sent ? "SENT" : "FAILED",
      provider: "resend",
      providerId: resendPayload.id ?? undefined,
      sentBy: session.email,
      sentAt: sent ? new Date() : undefined,
    },
  });

  if (!sent) {
    return NextResponse.json({ ok: false, status: log.status, message: resendPayload.message ?? "Mailet kunde inte skickas." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: log.status, message: "Sammanfattningen är skickad.", providerId: log.providerId });
}
