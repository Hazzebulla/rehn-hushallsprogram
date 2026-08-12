import BackupView from "./backup-view";
import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

export type BackupVm = {
  id: string;
  status: string;
  scope: string;
  storageKey: string;
  checksum: string;
  createdAt: string;
  finishedAt: string;
};

async function getBackups(): Promise<{ backups: BackupVm[]; databaseOnline: boolean }> {
  try {
    const backups = await prisma.backupJob.findMany({
      where: { companyId: "org_rehn_vvs" },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return {
      databaseOnline: true,
      backups: backups.map((backup) => ({
        id: backup.id,
        status: backup.status,
        scope: backup.scope,
        storageKey: backup.storageKey ?? "-",
        checksum: backup.checksumSha256?.slice(0, 18) ?? "-",
        createdAt: new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(backup.createdAt),
        finishedAt: backup.finishedAt
          ? new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(backup.finishedAt)
          : "-",
      })),
    };
  } catch {
    return {
      databaseOnline: false,
      backups: [
        {
          id: "LOCAL-BACKUP-1",
          status: "QUEUED",
          scope: "SQLITE_DATABASE_AND_DOCUMENTS",
          storageKey: "-",
          checksum: "-",
          createdAt: "Demo",
          finishedAt: "-",
        },
      ],
    };
  }
}

export default async function BackupPage() {
  const data = await getBackups();

  return (
    <main className="adminShell">
      <AdminSidebar active="backup" label="Backup" />
      <BackupView {...data} />
    </main>
  );
}
