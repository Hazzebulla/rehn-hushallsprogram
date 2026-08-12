import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

type AuditVm = {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  before: string;
  after: string;
};

const fallbackLogs: AuditVm[] = [
  {
    id: "LOCAL-AUDIT-1",
    actor: "Admin Rehn",
    action: "CREATE_CUSTOMER_WITH_PROPERTY",
    entity: "Customer",
    entityId: "Demo",
    createdAt: "Demo",
    before: "-",
    after: "Anna & Erik Svensson, Villa Ängby",
  },
];

function compactJson(value: unknown) {
  if (!value) return "-";
  return JSON.stringify(value).slice(0, 180);
}

async function getAudit(): Promise<{ logs: AuditVm[]; databaseOnline: boolean }> {
  try {
    const [logs, users] = await Promise.all([
      prisma.auditLog.findMany({
        where: { companyId: "org_rehn_vvs" },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.user.findMany({ where: { companyId: "org_rehn_vvs" } }),
    ]);

    const userNames = new Map(users.map((user) => [user.id, user.name]));

    return {
      databaseOnline: true,
      logs: logs.map((log) => ({
        id: log.id,
        actor: log.actorId ? userNames.get(log.actorId) ?? log.actorId : "System",
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        createdAt: new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "medium" }).format(log.createdAt),
        before: compactJson(log.before),
        after: compactJson(log.after),
      })),
    };
  } catch {
    return { databaseOnline: false, logs: fallbackLogs };
  }
}

export default async function HistoryPage() {
  const { logs, databaseOnline } = await getAudit();

  return (
    <main className="adminShell">
      <AdminSidebar active="history" label="Historik" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Audit log</p>
            <h1>Komplett historik över viktiga ändringar.</h1>
            <p>
              Varje kund, dokument, arbetsorder, fakturaunderlag och GDPR/backup-händelse ska kunna spåras.
            </p>
            <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
              {databaseOnline ? "Historik läses från databasen." : "Databasen är offline. Visar demohistorik."}
            </div>
          </div>
        </header>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Senaste händelser</h3>
            <span>{logs.length} loggrader</span>
          </div>
          <div className="historyList">
            {logs.map((log) => (
              <article key={log.id}>
                <div>
                  <span>{log.createdAt}</span>
                  <strong>{log.action}</strong>
                  <small>{log.actor}</small>
                </div>
                <div>
                  <span>Objekt</span>
                  <strong>{log.entity}</strong>
                  <small>{log.entityId}</small>
                </div>
                <div>
                  <span>Före</span>
                  <small>{log.before}</small>
                </div>
                <div>
                  <span>Efter</span>
                  <small>{log.after}</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
