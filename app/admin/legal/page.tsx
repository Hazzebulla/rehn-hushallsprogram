import AdminSidebar from "../admin-sidebar";

const legalRules = [
  ["20-årsplan", "Teknisk plan, inte bindande avtal.", "Visas med tydlig förklaring i portal och rapport."],
  ["Serviceavtal", "Separat accept krävs.", "Villkor, version, datum, IP och signerare sparas."],
  ["Risk och livslängd", "Uppskattning, inte garanti.", "Montörsändring kräver motivering och loggas."],
  ["Offert", "Bindande först efter accepterad version.", "Accepterade versioner skrivs aldrig över."],
  ["GDPR", "Export, rättning och radering ska kunna begäras.", "Ärenden kräver identitetskontroll."],
  ["Bilder", "Interna och kundsynliga bilder separeras.", "Synlighet styrs per dokument/bild."],
];

const consentItems = [
  ["Nödvändiga servicemeddelanden", "På", "Avtal, bokning, säkerhet och drift."],
  ["Marknadsföring", "Av", "Kunden ska kunna tacka nej separat."],
  ["SMS-påminnelser", "Ej valt", "Kräver kanalval eller samtycke."],
  ["Portalåtkomst", "På", "Endast egen fastighet och publicerade dokument."],
];

const simplePrinciples = [
  "En sak per sida.",
  "Kunden ser bara publicerat material.",
  "Admin ser tydligt vad som är internt.",
  "Alla viktiga ändringar loggas.",
  "Inga dolda avtal eller otydliga bindningstider.",
  "Offert, avtal och teknisk plan hålls separerade.",
];

export default function LegalPage() {
  return (
    <main className="adminShell">
      <AdminSidebar active="legal" label="Lagligt & enkelt" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Lagligt, snyggt, simpelt</p>
            <h1>Systemet ska sälja förtroende, inte skapa juridisk risk.</h1>
            <p>
              Kunden ska alltid förstå vad som är status, rekommendation, offert,
              avtal och historik. Inget blandas ihop.
            </p>
          </div>
        </header>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Juridiska produktregler</h3>
            <span>Regler som gränssnitt och datamodell följer</span>
          </div>
          <div className="legalList">
            {legalRules.map(([area, rule, implementation]) => (
              <div key={area}>
                <strong>{area}</strong>
                <span>{rule}</span>
                <b>{implementation}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="adminGrid lower">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Samtycken</h3>
              <span>Separera nödvändigt från marknadsföring</span>
            </div>
            <div className="consentList">
              {consentItems.map(([name, status, detail]) => (
                <div key={name}>
                  <strong>{name}</strong>
                  <b>{status}</b>
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Enkelhetsprinciper</h3>
              <span>Så håller vi appen användbar</span>
            </div>
            <ul className="simpleList">
              {simplePrinciples.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        </section>
      </section>
    </main>
  );
}
