import AdminSidebar from "../admin-sidebar";

const settings = [
  ["Företagsinformation", "Rehn VVS, logotyp, kontaktuppgifter och rapportfot"],
  ["Prisregler", "Timpris, servicebil, materialpåslag, ROT och avrundning"],
  ["Rapportinställningar", "Risknivåer, kontrollintervall, signering och publicering"],
  ["Bildkrav", "Standardbilder per aktiv formulärsektion"],
  ["Behörighet", "Admin, arbetsledare, montör och kund"],
  ["Juridik", "GDPR, samtycke, export och radering"],
];

export default function SettingsPage() {
  return (
    <main className="adminShell">
      <AdminSidebar active="settings" label="Inställningar" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">System</p>
            <h1>Inställningar</h1>
            <p>Här samlas sådant som styr Husrapporten utan att ligga i huvudflödet för montören.</p>
          </div>
        </header>

        <section className="adminGrid lower">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Husrapport</h3>
              <span>Grundinställningar</span>
            </div>
            <div className="systemChecks">
              {settings.map(([name, detail]) => (
                <div key={name}>
                  <strong>{name}</strong>
                  <b>Förberett</b>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Underliggande sidor</h3>
              <span>Dolda från huvudmenyn men finns kvar</span>
            </div>
            <div className="queue">
              <div><span>Åtkomst</span><strong>Roller och inloggning</strong><a className="buttonLink" href="/admin/access">Öppna</a></div>
              <div><span>Historik</span><strong>Ändringslogg</strong><a className="buttonLink" href="/admin/history">Öppna</a></div>
              <div><span>Backup</span><strong>Säkerhetskopior</strong><a className="buttonLink" href="/admin/backup">Öppna</a></div>
              <div><span>GDPR</span><strong>Export och radering</strong><a className="buttonLink" href="/admin/gdpr">Öppna</a></div>
              <div><span>Juridik</span><strong>Villkor och samtycke</strong><a className="buttonLink" href="/admin/legal">Öppna</a></div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
