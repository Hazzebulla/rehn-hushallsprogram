import { foundationChecklist, rehnVvsOrganization, roleMatrix } from "../../../lib/foundation";
import AdminSidebar from "../admin-sidebar";

const dataFlow = [
  "Login",
  "Tenant-scope",
  "Rollpolicy",
  "Kund",
  "Fastighet",
  "Dokument",
  "Historik",
  "Backup/GDPR",
];

export default function FoundationPage() {
  return (
    <main className="adminShell">
      <AdminSidebar active="foundation" label="Fas 1 fundament" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Fas 1</p>
            <h1>Fundamentet för Rehn VVS byggs först.</h1>
            <p>
              Här samlas det som måste vara rätt innan rapport, kundportal och arbetsflöden byggs vidare:
              inloggning, organisation, roller, register, databas, lagring, historik, backup och GDPR.
            </p>
          </div>
        </header>

        <section className="foundationHero">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Organisation</h3>
              <span>Första tenant i systemet</span>
            </div>
            <div className="orgCard">
              <div className="miniMark" />
              <div>
                <strong>{rehnVvsOrganization.name}</strong>
                <span>Org.nr {rehnVvsOrganization.orgNo}</span>
                <small>Tenant: {rehnVvsOrganization.tenantKey}</small>
              </div>
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Säker kedja</h3>
              <span>Varje request måste passera dessa steg</span>
            </div>
            <div className="securityFlow">
              {dataFlow.map((step, index) => (
                <div key={step}>
                  <b>{index + 1}</b>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Roller och behörigheter</h3>
            <span>Admin, arbetsledare, montör och kund separeras från start</span>
          </div>
          <div className="roleMatrix">
            {Object.entries(roleMatrix).map(([role, permissions]) => (
              <article key={role}>
                <h3>{role === "SUPERVISOR" ? "ARBETSLEDARE" : role === "WORKER" ? "MONTÖR" : role}</h3>
                {permissions.map((permission) => <span key={permission}>{permission}</span>)}
              </article>
            ))}
          </div>
        </section>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Byggstatus fundament</h3>
            <span>Vad som finns i demon och vad som blir produktionsdel</span>
          </div>
          <div className="foundationList">
            {foundationChecklist.map((item) => (
              <div key={item.area}>
                <strong>{item.area}</strong>
                <b>{item.status}</b>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
