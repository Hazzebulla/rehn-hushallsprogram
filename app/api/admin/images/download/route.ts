import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { extractHusstatusImages } from "../../../../../lib/husstatus-images";
import { getCurrentSessionUser } from "../../../../../lib/session";
import { rvmSections } from "../../../../admin/husstatus-form/spec";

export const dynamic = "force-dynamic";

const COMPANY_ID = "org_rehn_vvs";

function safeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "bild";
}

function extensionFromMime(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("gif")) return "gif";
  return "jpg";
}

function dataUrlToBuffer(dataUrl: string) {
  const [, payload] = dataUrl.split(",", 2);
  if (!payload) return null;
  return Buffer.from(payload, "base64");
}

export async function GET(request: NextRequest) {
  const session = await getCurrentSessionUser();
  if (!session) {
    return NextResponse.json({ message: "Logga in för att ladda ner bilder." }, { status: 401 });
  }

  const propertyId = request.nextUrl.searchParams.get("propertyId") ?? undefined;
  const submissions = await prisma.formSubmission.findMany({
    where: {
      companyId: COMPANY_ID,
      OR: [
        { version: { templateId: "tpl_rvm_husstatus_24" } },
        { inspection: { type: "RVM_HUSSTATUS_24" } },
      ],
      ...(propertyId ? { inspection: { propertyId, companyId: COMPANY_ID } } : {}),
    },
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
    orderBy: { updatedAt: "desc" },
    take: 150,
  });

  const images = extractHusstatusImages(submissions, rvmSections).filter((image) => !propertyId || image.propertyId === propertyId);
  if (!images.length) {
    return NextResponse.json({ message: "Inga bilder finns att ladda ner." }, { status: 404 });
  }

  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const image of images) {
    const buffer = dataUrlToBuffer(image.dataUrl);
    if (!buffer) continue;

    const folder = [
      safeName(image.customerName),
      safeName(image.propertyName || image.address),
      `${String(image.sectionId).padStart(2, "0")}-${safeName(image.sectionTitle)}`,
    ].join("/");
    const extension = extensionFromMime(image.mimeType);
    const base = `${safeName(image.fieldLabel)}-${safeName(image.id)}.${extension}`;
    const fullName = `${folder}/${base}`;
    const count = usedNames.get(fullName) ?? 0;
    usedNames.set(fullName, count + 1);
    const fileName = count ? fullName.replace(new RegExp(`\\.${extension}$`), `-${count + 1}.${extension}`) : fullName;
    zip.file(fileName, buffer);
  }

  zip.file(
    "README.txt",
    [
      "RVM Husstatus - bildexport",
      `Skapad: ${new Date().toLocaleString("sv-SE")}`,
      `Antal bilder: ${images.length}`,
      "",
      "Mapparna är ordnade enligt:",
      "kund / fastighet / formulärsektion / bildfil",
    ].join("\n"),
  );

  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const fileName = propertyId
    ? `rvm-bilder-${safeName(images[0].customerName)}-${safeName(images[0].propertyName)}.zip`
    : `rvm-alla-bilder-${new Date().toISOString().slice(0, 10)}.zip`;

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/zip",
    },
  });
}
