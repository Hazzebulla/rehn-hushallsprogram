"use server";

import { createHash } from "crypto";
import { copyFile, mkdir, stat, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";

const COMPANY_ID = "org_rehn_vvs";
const DEMO_ACTOR_ID = "usr_admin_rehn";

export async function runLocalBackupAction() {
  const backup = await prisma.backupJob.create({
    data: {
      companyId: COMPANY_ID,
      status: "RUNNING",
      scope: "SQLITE_DATABASE_AND_DOCUMENTS",
      startedAt: new Date(),
    },
  });

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = path.join(process.cwd(), "storage", "backups");
    const sourceDb = path.join(process.cwd(), "prisma", "dev.db");
    const dbTarget = path.join(backupDir, `${stamp}-dev.db`);
    const manifestTarget = path.join(backupDir, `${stamp}-manifest.json`);

    await mkdir(backupDir, { recursive: true });
    await copyFile(sourceDb, dbTarget);

    const dbInfo = await stat(dbTarget);
    const manifest = {
      createdAt: new Date().toISOString(),
      scope: "SQLITE_DATABASE_AND_DOCUMENTS",
      databaseFile: path.basename(dbTarget),
      databaseBytes: dbInfo.size,
      documentsPath: "storage/documents",
    };
    const manifestJson = JSON.stringify(manifest, null, 2);
    const checksumSha256 = createHash("sha256").update(manifestJson).digest("hex");

    await writeFile(manifestTarget, manifestJson);

    await prisma.$transaction([
      prisma.backupJob.update({
        where: { id: backup.id },
        data: {
          status: "SUCCEEDED",
          storageKey: `storage/backups/${path.basename(manifestTarget)}`,
          checksumSha256,
          finishedAt: new Date(),
        },
      }),
      prisma.auditLog.create({
        data: {
          companyId: COMPANY_ID,
          actorId: DEMO_ACTOR_ID,
          action: "RUN_LOCAL_BACKUP",
          entity: "BackupJob",
          entityId: backup.id,
          after: { storageKey: `storage/backups/${path.basename(manifestTarget)}`, checksumSha256 },
        },
      }),
    ]);

    revalidatePath("/admin/backup");
    return { ok: true, message: "Lokal backup skapades." };
  } catch {
    await prisma.backupJob.update({
      where: { id: backup.id },
      data: { status: "FAILED", finishedAt: new Date(), error: "Backup kunde inte skapas lokalt." },
    });
    revalidatePath("/admin/backup");
    return { ok: false, message: "Backup kunde inte skapas." };
  }
}
