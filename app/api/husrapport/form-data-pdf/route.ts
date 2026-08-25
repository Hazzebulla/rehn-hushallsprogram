import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getCurrentSessionUser } from "../../../../lib/session";
import { rvmSections } from "../../../admin/husstatus-form/spec";

export const dynamic = "force-dynamic";

const COMPANY_ID = "org_rehn_vvs";
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

type PhotoValue = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
};

type SignatureValue = {
  label?: string;
  signedBy?: string;
  role?: string;
  signedAt?: string;
  imageDataUrl?: string;
};

type PdfState = {
  doc: PDFDocument;
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
  pageNo: number;
};

type SectionStatusMap = Record<string, "active" | "not_applicable">;

function answerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as { value?: unknown; values?: unknown };
  return record.value ?? record.values ?? value;
}

function cleanText(value: unknown) {
  let text = String(value ?? "").trim();
  for (let index = 0; index < 3 && /Ã|Â|â/.test(text); index += 1) {
    try {
      text = Buffer.from(text, "latin1").toString("utf8");
    } catch {
      break;
    }
  }

  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[→]/g, "->")
    .replace(/[•·]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function isPhoto(value: unknown): value is PhotoValue {
  return !!value && typeof value === "object" && !Array.isArray(value) && "mimeType" in value;
}

function formatBytes(size?: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function photoLine(photo: PhotoValue, fallbackIndex: number) {
  const id = cleanText(photo.id || `bild-${fallbackIndex}`);
  const name = cleanText(photo.name || "Namnlös bild");
  const meta = [cleanText(photo.mimeType), formatBytes(photo.size), cleanText(photo.createdAt)].filter(Boolean).join(" - ");
  return `${id} - ${name}${meta ? ` (${meta})` : ""}`;
}

function extractPhotoLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  if (value.every(isPhoto)) return value.map(photoLine);

  return value.flatMap((item, rowIndex) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const photos = (item as { photos?: unknown }).photos;
    if (!Array.isArray(photos)) return [];
    return photos.filter(isPhoto).map((photo, photoIndex) => `Rad ${rowIndex + 1}: ${photoLine(photo, photoIndex + 1)}`);
  });
}

function extractSignatures(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, SignatureValue>)
    .map(([id, signature]) => ({ id, ...signature }))
    .filter((signature) => signature.imageDataUrl && signature.signedBy);
}

async function drawSignatureImage(state: PdfState, dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return;
  const image = await state.doc.embedPng(Buffer.from(match[1], "base64"));
  const maxWidth = 190;
  const maxHeight = 72;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  ensureSpace(state, height + 8);
  state.page.drawImage(image, {
    x: MARGIN + 10,
    y: state.y - height,
    width,
    height,
  });
  state.y -= height + 8;
}

function formatComponentRows(value: unknown) {
  if (!Array.isArray(value)) return "";

  return value
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row, index) => {
      const item = row as Record<string, unknown>;
      const cells = [
        cleanText(item.typeName),
        cleanText(item.systemName),
        cleanText(item.category),
        [cleanText(item.brand), cleanText(item.model)].filter(Boolean).join(" "),
        cleanText(item.serialNo),
        cleanText(item.installedYear),
        cleanText(item.status),
        [cleanText(item.replacementYear), cleanText(item.replacementPeriod)].filter(Boolean).join(" "),
        cleanText(item.costKr) ? `${cleanText(item.costKr)} kr` : "",
      ].filter(Boolean);
      return cells.length ? `${index + 1}. ${cells.join(" | ")}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatAnswer(value: unknown) {
  if (value === undefined || value === null || value === "") return "Ej ifyllt";

  if (Array.isArray(value)) {
    if (!value.length) return "Ej ifyllt";
    if (value.every(isPhoto)) return "Se bild-ID nedan";
    if (value.some((item) => item && typeof item === "object")) {
      const rows = formatComponentRows(value);
      return rows || "Ej ifyllt";
    }
    return value.map(cleanText).filter(Boolean).join(", ") || "Ej ifyllt";
  }

  return cleanText(value) || "Ej ifyllt";
}

function sectionStatuses(answers: Map<string, unknown>): SectionStatusMap {
  const value = answers.get("section_statuses");
  return value && typeof value === "object" && !Array.isArray(value) ? value as SectionStatusMap : {};
}

function isSectionActive(statuses: SectionStatusMap, sectionId: number) {
  return statuses[String(sectionId)] !== "not_applicable";
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function addPage(state: PdfState) {
  state.page = state.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.pageNo += 1;
  state.y = PAGE_HEIGHT - MARGIN;
  state.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.027, 0.063, 0.063) });
}

function ensureSpace(state: PdfState, height: number) {
  if (state.y - height < MARGIN + 16) addPage(state);
}

function drawText(
  state: PdfState,
  text: string,
  options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {},
) {
  const size = options.size ?? 9;
  const font = options.font ?? state.regular;
  const indent = options.indent ?? 0;
  const lineHeight = size * 1.25;
  const lines = cleanText(text)
    .split("\n")
    .flatMap((line) => wrapLine(line, font, size, CONTENT_WIDTH - indent));

  ensureSpace(state, Math.max(lineHeight, lines.length * lineHeight));
  for (const line of lines) {
    state.page.drawText(line, {
      x: MARGIN + indent,
      y: state.y,
      size,
      font,
      color: options.color ?? rgb(0.85, 0.91, 0.9),
    });
    state.y -= lineHeight;
    ensureSpace(state, lineHeight);
  }
  state.y -= options.gap ?? 2;
}

function drawDivider(state: PdfState) {
  ensureSpace(state, 12);
  state.page.drawLine({
    start: { x: MARGIN, y: state.y },
    end: { x: PAGE_WIDTH - MARGIN, y: state.y },
    thickness: 0.7,
    color: rgb(0.15, 0.42, 0.46),
  });
  state.y -= 12;
}

async function createPdfBytes(args: {
  propertyLabel: string;
  customerLabel: string;
  submissionLabel: string;
  answers: Map<string, unknown>;
}) {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const state: PdfState = { doc, page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]), regular, bold, y: PAGE_HEIGHT - MARGIN, pageNo: 1 };

  state.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.027, 0.063, 0.063) });
  drawText(state, "RVM Husstatus - formulärdata", { size: 20, font: bold, color: rgb(0.98, 1, 1), gap: 8 });
  drawText(state, `Fastighet: ${args.propertyLabel}`, { size: 8, color: rgb(0.62, 0.8, 0.82) });
  drawText(state, `Kund: ${args.customerLabel}`, { size: 8, color: rgb(0.62, 0.8, 0.82) });
  drawText(state, `Underlag: ${args.submissionLabel}`, { size: 8, color: rgb(0.62, 0.8, 0.82) });
  drawText(state, `Export: ${new Date().toLocaleString("sv-SE")}`, { size: 8, color: rgb(0.62, 0.8, 0.82), gap: 8 });
  drawDivider(state);
  const statuses = sectionStatuses(args.answers);

  for (const section of rvmSections) {
    drawText(state, `${section.id}. ${section.title}`, { size: 13, font: bold, color: rgb(0.2, 0.84, 0.9), gap: 3 });
    if (section.description) drawText(state, section.description, { size: 8, color: rgb(0.62, 0.8, 0.82), gap: 7 });

    if (!isSectionActive(statuses, section.id)) {
      drawText(state, "Finns ej i fastigheten", { size: 9, font: bold, color: rgb(0.98, 0.76, 0.36), indent: 10, gap: 8 });
      drawDivider(state);
      continue;
    }

    for (const field of section.fields) {
      const value = args.answers.get(field.key);
      const source = args.answers.get(`${field.key}__source`);
      const photos = args.answers.get(`${field.key}__photos`);
      const photoLines = [...extractPhotoLines(value), ...extractPhotoLines(photos)];

      drawText(state, field.label, { size: 9, font: bold, color: rgb(0.98, 1, 1), gap: 1 });
      drawText(state, formatAnswer(value), { size: 8.5, color: rgb(0.84, 0.9, 0.89), indent: 10, gap: 2 });

      if (source) {
        drawText(state, `Källa/status: ${formatAnswer(source)}`, { size: 7.5, color: rgb(0.62, 0.8, 0.82), indent: 10, gap: 2 });
      }

      if (photoLines.length) {
        drawText(state, `Bild-ID: ${photoLines.join("; ")}`, { size: 7.5, color: rgb(0.2, 0.84, 0.9), indent: 10, gap: 2 });
      }
    }

    drawDivider(state);
  }

  const signatureList = extractSignatures(args.answers.get("signatures"));
  if (signatureList.length) {
    drawText(state, "Digitala signaturer", { size: 13, font: bold, color: rgb(0.2, 0.84, 0.9), gap: 5 });
    for (const signature of signatureList) {
      drawText(state, `Signerad av: ${cleanText(signature.signedBy)}`, { size: 9, font: bold, color: rgb(0.98, 1, 1), gap: 1 });
      drawText(state, `Roll: ${cleanText(signature.role)} · Datum: ${signature.signedAt ? new Date(signature.signedAt).toLocaleString("sv-SE") : "Ej angivet"}`, { size: 8, color: rgb(0.62, 0.8, 0.82), indent: 10, gap: 3 });
      await drawSignatureImage(state, String(signature.imageDataUrl));
    }
    drawDivider(state);
  }

  const pages = doc.getPages();
  pages.forEach((page, index) => {
    const text = `RVM Husstatus formulärdata - ${index + 1}/${pages.length}`;
    page.drawText(text, {
      x: PAGE_WIDTH / 2 - regular.widthOfTextAtSize(text, 7) / 2,
      y: 18,
      size: 7,
      font: regular,
      color: rgb(0.44, 0.68, 0.71),
    });
  });

  return doc.save();
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSessionUser();
  if (!session) {
    return NextResponse.json({ message: "Logga in för att exportera PDF." }, { status: 401 });
  }

  const propertyId = request.nextUrl.searchParams.get("propertyId") ?? undefined;
  const property = await prisma.property.findFirst({
    where: propertyId ? { id: propertyId, companyId: COMPANY_ID } : { companyId: COMPANY_ID },
    include: { customer: true },
    orderBy: { updatedAt: "desc" },
  });

  if (!property) {
    return NextResponse.json({ message: "Fastighet saknas." }, { status: 404 });
  }

  const submission = await prisma.formSubmission.findFirst({
    where: {
      companyId: COMPANY_ID,
      inspection: { propertyId: property.id, companyId: COMPANY_ID },
    },
    include: { answers: true },
    orderBy: [{ signedAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!submission) {
    return NextResponse.json({ message: "Inget formulärunderlag finns för fastigheten." }, { status: 404 });
  }

  const answers = new Map(submission.answers.map((answer) => [answer.fieldKey, answerValue(answer.value)]));
  const pdf = await createPdfBytes({
    answers,
    customerLabel: property.customer.name,
    propertyLabel: `${property.propertyNo ?? property.type} - ${property.address}`,
    submissionLabel: `${submission.status} - ${submission.signedAt?.toLocaleDateString("sv-SE") ?? submission.updatedAt.toLocaleDateString("sv-SE")}`,
  });
  const filename = `rvm-formulardata-${property.propertyNo ?? property.id}.pdf`
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .toLowerCase();

  return new NextResponse(pdf as BodyInit, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/pdf",
    },
  });
}


