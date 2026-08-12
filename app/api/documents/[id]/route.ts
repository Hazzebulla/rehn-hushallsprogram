import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const document = await prisma.documentAsset.findFirst({
    where: { id, companyId: "org_rehn_vvs" },
  });

  if (!document) {
    return NextResponse.json({ message: "Dokument saknas." }, { status: 404 });
  }

  try {
    const filePath = path.join(process.cwd(), "storage", "documents", document.storageKey);
    const bytes = await readFile(filePath);

    return new Response(bytes, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${document.fileName}"`,
        "X-Document-Checksum": document.checksumSha256,
      },
    });
  } catch {
    return NextResponse.json(
      {
        message: "Filen finns registrerad men saknas i lokal lagring.",
        title: document.title,
        storageKey: document.storageKey,
      },
      { status: 404 },
    );
  }
}
