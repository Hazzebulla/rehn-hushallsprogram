import { NextRequest, NextResponse } from "next/server";
import { rvmSections } from "../../../../../../app/admin/husstatus-form/spec";
import { extractHusstatusImages } from "../../../../../../lib/husstatus-images";
import { prisma } from "../../../../../../lib/prisma";
import { getCurrentSessionUser } from "../../../../../../lib/session";
import type { ReportAnswerDetails, ReportAnswerGroup, ReportAnswerItem } from "../../../../../../app/admin/reports/reports-view";

const answeredText = "Ej besvarat";

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

function unwrapAnswerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as { value?: unknown; values?: unknown };
  return record.values ?? record.value ?? value;
}

function answerMap(answers: Array<{ fieldKey: string; value: unknown }>) {
  return Object.fromEntries(answers.map((answer) => [answer.fieldKey, unwrapAnswerValue(answer.value)]));
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function readableKey(key: string) {
  return key
    .replace(/__/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function valueLabel(value: unknown): string {
  if (isEmpty(value)) return answeredText;
  if (Array.isArray(value)) {
    return value.map(valueLabel).filter((item) => item && item !== answeredText).join(", ") || answeredText;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("dataUrl" in record) return String(record.name ?? "Bild");
    return Object.entries(record)
      .filter(([key]) => key !== "dataUrl" && key !== "photos")
      .map(([key, entry]) => `${readableKey(key)}: ${valueLabel(entry)}`)
      .filter((item) => !item.endsWith(answeredText))
      .join(" · ") || answeredText;
  }
  return String(value);
}

function groupedAnswers(answers: Record<string, unknown>): ReportAnswerGroup[] {
  return rvmSections.map((section): ReportAnswerGroup => ({
    id: String(section.id),
    title: section.title,
    items: section.fields.map((field): ReportAnswerItem => {
      const value = valueLabel(answers[field.key]);
      return {
        key: field.key,
        label: field.label,
        value,
        answered: value !== answeredText,
      };
    }),
  }));
}

function countProblems(answers: Record<string, unknown>): number {
  const issueKeys = ["observations", "known_issues", "alarms", "history_notes", "kitchen_notes", "sewer_notes"];
  const declaration = answers.customer_self_declaration && typeof answers.customer_self_declaration === "object"
    ? answers.customer_self_declaration as Record<string, unknown>
    : {};
  const wetRooms = declaration.wetRooms && typeof declaration.wetRooms === "object" ? declaration.wetRooms as Record<string, unknown> : {};
  const values = [
    wetRooms.problems,
    declaration.focusAreas,
    ...issueKeys.map((key) => answers[key]),
  ];
  return values.reduce<number>((count, value) => {
    if (Array.isArray(value)) return count + value.filter((item) => String(item ?? "").trim()).length;
    return count + (String(value ?? "").trim() ? 1 : 0);
  }, 0);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getCurrentSessionUser();
  if (!session || session.role === "CUSTOMER") {
    return NextResponse.json({ message: "Inte inloggad." }, { status: 401 });
  }

  const { reportId } = await context.params;
  const report = await prisma.houseReport.findFirst({
    where: { id: reportId, companyId: session.companyId },
    include: {
      submission: {
        include: {
          answers: true,
          inspection: {
            include: {
              property: {
                include: { customer: true },
              },
            },
          },
        },
      },
    },
  });

  if (!report) {
    return NextResponse.json({ message: "Rapporten hittades inte." }, { status: 404 });
  }

  const answers = answerMap(report.submission.answers);
  const answerGroups = groupedAnswers(answers);
  const fieldKeys = new Set(rvmSections.flatMap((section) => section.fields.map((field) => field.key)));
  const answeredQuestions = answerGroups.reduce((sum, group) => sum + group.items.filter((item) => item.answered).length, 0);
  const totalQuestions = rvmSections.reduce((count, section) => count + section.fields.length, 0);
  const images = extractHusstatusImages([report.submission], rvmSections)
    .filter((image) => image.dataUrl)
    .map((image) => ({
      id: image.id,
      title: `${image.sectionTitle} - ${image.fieldLabel}`,
      fileName: image.fileName,
      dataUrl: image.dataUrl,
      createdAt: image.createdAt,
    }));
  const extraAnswers = Object.entries(answers)
    .filter(([key]) => !fieldKeys.has(key) && !key.endsWith("__source") && !key.endsWith("__photos") && key !== "customer_self_declaration")
    .map(([key, value]) => ({
      key,
      label: readableKey(key),
      value: valueLabel(value),
      answered: true,
    }))
    .filter((item) => item.value !== answeredText);
  const problemCount = countProblems(answers);

  const details: ReportAnswerDetails = {
    summaryText: `${answeredQuestions} av ${totalQuestions} frågor besvarade · ${images.length} bilder · ${problemCount} rapporterade problem`,
    answeredQuestions,
    totalQuestions,
    imageCount: images.length,
    problemCount,
    answerGroups,
    extraAnswers,
    images,
  };

  return NextResponse.json(details);
}
