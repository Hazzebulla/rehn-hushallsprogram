import AdminSidebar from "./admin-sidebar";

const foundationStats = [
  ["Organisation", "Rehn VVS", "Tenant aktiv"],
  ["Användare", "4 roller", "Admin, arbetsledare, montör, kund"],
  ["Kunder", "2 demo", "Kopplade till fastigheter"],
  ["Databas", "Prisma", "Schema validerat"],
];

const queue = [
  ["Kundärende", "Tryckfall i värmesystem", "Skapa arbetsorder"],
  ["Rekommendation", "Expansionskärl hög risk", "Skicka offert"],
  ["Portalaktivitet", "Kund öppnade 20-årsplan", "Följ upp"],
  ["Dokument", "Egenkontroll signerad", "Lås journalversion"],
];

const systemChecks = [
  ["Säker inloggning", "Förberedd", "AuthAccount, sessionshash och MFA-flagga finns i schema"],
  ["Behörighetssystem", "Aktivt i kod", "Tenant-kontroll före rollpolicy"],
  ["Dokument/bilder", "Modellerat", "Storage key, checksum, version och synlighet"],
  ["Ändringshistorik", "Modellerat", "AuditLog med before/after och IP-adress"],
  ["Backup", "Förberett", "BackupJob spårar körningar och checksum"],
  ["GDPR", "Förberett", "Export, radering och rättning som ärenden"],
];

const documents = [
  ["RVM Husstatus Premium Rapport", "Kund", "Version 1", "PDF"],
  ["Egenkontroll expansionskärl", "Kund", "Signerad", "PDF"],
  ["Bild teknikrum", "Internt", "Original sparat", "JPG"],
  ["Serviceavtal utkast", "Internt", "Ej publicerad", "PDF"],
];

const audit = [
  ["14:02", "Admin Rehn", "Skapade kund", "Anna & Erik Svensson"],
  ["14:07", "Arbetsledare Rehn", "Publicerade dokument", "Husstatusrapport"],
  ["14:11", "System", "Backup köad", "DATABASE_AND_DOCUMENTS"],
  ["14:18", "Kund", "Öppnade portal", "Villa Ängby"],
];

export default function AdminPage() {
  return (
    <main className="adminShell">
      <AdminSidebar active="admin" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Fas 1 kontrollrum</p>
            <h1>Rehn VVS-grunden för kund, fastighet, portal och husrapport.</h1>
            <p>
              Adminytan visar fundamentet först. När databasen är igång blir samma ytor datadrivna:
              kunder, fastigheter, dokument, historik, backup och GDPR.
            </p>
          </div>
          <div className="portalActions">
            <a className="buttonLink" href="/admin/customers">Ny kund</a>
            <a className="buttonLink" href="/admin/properties">Fastigheter</a>
            <a className="buttonLink" href="/admin/installations">Installationer</a>
            <a className="buttonLink" href="/admin/energy-analysis">Energianalys värme</a>
            <a className="buttonLink" href="/admin/report-import">Rapportimport</a>
            <a className="buttonLink" href="/admin/access">Åtkomst</a>
            <a className="buttonLink" href="/admin/requests">Visa ärenden</a>
            <a className="buttonLink" href="/admin/workorders">Arbetsorder</a>
            <a className="buttonLink" href="/admin/invoicing">Fakturaunderlag</a>
            <a className="buttonLink" href="/admin/documents">Dokument</a>
            <a className="buttonLink" href="/admin/history">Historik</a>
            <a className="buttonLink" href="/admin/foundation">Visa fundament</a>
            <a className="buttonLink" href="/admin/legal">Lagligt</a>
          </div>
        </header>

        <section className="adminKpis">
          {foundationStats.map(([label, value, detail]) => (
            <article className="portalPanel" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </section>

        <section className="adminGrid">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Portalhändelser</h3>
              <span>Från kundkonto till åtgärd</span>
            </div>
            <div className="queue">
              {queue.map(([type, title, action]) => (
                <div key={title}>
                  <span>{type}</span>
                  <strong>{title}</strong>
                  <a className="buttonLink" href="/admin/requests">{action}</a>
                </div>
              ))}
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Fas 1-status</h3>
              <span>Produktionsdelar som måste sitta</span>
            </div>
            <div className="systemChecks">
              {systemChecks.map(([name, status, detail]) => (
                <div key={name}>
                  <strong>{name}</strong>
                  <b>{status}</b>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="adminGrid lower">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Dokument och bildlagring</h3>
              <span>Publicering styr vad kunden ser</span>
            </div>
            <table>
              <thead>
                <tr><th>Dokument</th><th>Synlighet</th><th>Status</th><th>Typ</th></tr>
              </thead>
              <tbody>
                {documents.map((row) => (
                  <tr key={row.join("-")}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Senaste historik</h3>
              <span>Audit log</span>
            </div>
            <div className="auditList">
              {audit.map(([time, actor, action, entity]) => (
                <div key={`${time}-${action}`}>
                  <time>{time}</time>
                  <strong>{actor}</strong>
                  <span>{action}</span>
                  <b>{entity}</b>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Databas och drift</h3>
            <span>Gratis lokal Postgres är förberedd</span>
          </div>
          <div className="opsGrid">
            <div><strong>Schema</strong><span>Prisma validerat</span></div>
            <div><strong>Seed</strong><span>Rehn VVS-data redo</span></div>
            <div><strong>Databas</strong><span>Väntar på lokal Postgres/Docker</span></div>
            <div><strong>Nästa steg</strong><span>Planering, tidrapport och fakturaunderlag</span></div>
          </div>
        </section>
      </section>
    </main>
  );
}
