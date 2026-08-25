const riskBars = [
  { label: "Värme", value: 84 },
  { label: "Tappvatten", value: 68 },
  { label: "Avlopp", value: 58 },
  { label: "Ventiler", value: 74 },
  { label: "Bilder", value: 52 },
  { label: "Journal", value: 39 },
];

const metrics = [
  { label: "Husstatus", value: "78", status: "av 100" },
  { label: "Riskindex", value: "28", status: "Låg" },
  { label: "Bilder", value: "24", status: "Dokumenterade" },
  { label: "Åtgärder", value: "5", status: "Prioriterade" },
];

const recommendations = [
  "Byt expansionskärl inom 1 år",
  "Dokumentera värmepumpens typskylt",
  "Kontrollera radiatorventiler plan 1",
  "Verifiera kundens Huscheck på plats",
  "Uppdatera husjournal efter genomgång",
];

const maintenance = [
  { component: "Expansionskärl", years: [2026, 2027], cost: "18 000 kr" },
  { component: "Radiatorventiler plan 1", years: [2027, 2028, 2029], cost: "42 000 kr" },
  { component: "Cirkulationspump CP-2", years: [2030, 2031], cost: "24 500 kr" },
  { component: "Blandningsventil", years: [2032], cost: "9 800 kr" },
  { component: "Varmvattenberedare", years: [2035, 2036, 2037], cost: "38 000 kr" },
  { component: "Golvvärmefördelare", years: [2040, 2041], cost: "31 000 kr" },
];

const years = Array.from({ length: 20 }, (_, index) => 2026 + index);

const components = [
  ["Värmesystem", "Cirkulationspump", "Teknikrum", "2014", "Röd", "18 000 kr"],
  ["Radiatorer", "Termostatventiler", "Plan 1", "2009", "Orange", "42 000 kr"],
  ["Tappvatten", "Blandningsventil", "Tvättstuga", "2016", "Gul", "9 800 kr"],
  ["Värme", "Expansionskärl", "Teknikrum", "2011", "Röd", "18 000 kr"],
  ["Sanitet", "WC-stol", "Badrum 2", "2019", "Grön", "6 500 kr"],
];

const workflow = [
  "Kunduppgift",
  "Fastighet",
  "Huscheck",
  "Platsbesök",
  "Husrapport",
  "Husjournal",
];

export default function Page() {
  return (
    <main className="reportShell">
      <nav className="modeNav" aria-label="Navigation">
        <a className="active" href="/">Översikt</a>
        <a href="/huscheck">Huscheck</a>
        <a href="/husrapport">Husrapport</a>
        <a href="/portal">Kundvy</a>
        <a href="/admin">Admin</a>
      </nav>
      <section className="cover">
        <div className="coverTop">
          <div className="stagMark">
            <span />
          </div>
          <div className="seal">20 år<br />journal</div>
        </div>

        <div className="coverTitle">
          <p>Husrapport, kunduppgifter och VVS-dokumentation</p>
          <h1>RVM Husrapport</h1>
          <span>Ett fokuserat system för fastighetsdata, bilder, komponenter och kundens husjournal.</span>
        </div>

        <div className="houseFrame">
          <div className="roof" />
          <div className="house">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="car" />
        </div>

        <dl className="coverFacts">
          <div><dt>Kund</dt><dd>Anna & Erik Svensson</dd></div>
          <div><dt>Fastighet</dt><dd>Villa Ängby, Bromma</dd></div>
          <div><dt>Underlag</dt><dd>Kunduppgift + platsbesök</dd></div>
          <div><dt>Rapport</dt><dd>RVM-HS-2026-0001</dd></div>
        </dl>
      </section>

      <section className="report">
        <header className="reportHeader">
          <div className="brandLine">
            <div className="miniMark" />
            <div>
              <strong>RVM Husrapport</strong>
              <span>Husjournal · Rehn VVS</span>
            </div>
          </div>
          <div className="reportMeta">
            <span>Systemläge</span>
            <strong>Husrapport</strong>
          </div>
        </header>

        <section className="summary">
          <div>
            <p className="sectionKicker">Fokuserat system</p>
            <h2>Kunduppgifter in, platskontroll på plats, tydlig Husrapport ut.</h2>
            <p>
              Systemet samlar kundregister, fastigheter, Huscheck, montörsformulär, bilddokumentation,
              komponentregister, husrapport och 20-årig husjournal. Huvudflödet är begränsat till kunddata,
              tekniskt underlag och rapport.
            </p>
          </div>
          <div className="flow">
            {workflow.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>

        <section className="metricGrid">
          {metrics.map((metric) => (
            <article className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <div className="ring"><strong>{metric.value}</strong></div>
              <small>{metric.status}</small>
            </article>
          ))}
        </section>

        <section className="split">
          <article className="panel riskPanel">
            <div className="panelTitle">
              <h3>Risköversikt</h3>
              <span>Tekniskt område i Husrapport</span>
            </div>
            <div className="bars">
              {riskBars.map((bar) => (
                <div className="bar" key={bar.label}>
                  <i style={{ height: `${bar.value}%` }} />
                  <span>{bar.label}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panelTitle">
              <h3>Nästa åtgärder</h3>
              <span>Från rapport och kundunderlag</span>
            </div>
            <ol className="recommendations">
              {recommendations.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </article>
        </section>

        <section className="panel planPanel">
          <div className="panelTitle">
            <h3>20-årig åtgärds- och investeringsplan</h3>
            <span>Planeringsunderlag, inte bindande offert eller garanti</span>
          </div>
          <div className="planGrid">
            <div className="planHead">Komponent</div>
            {years.map((year) => <div className="year" key={year}>{String(year).slice(2)}</div>)}
            <div className="planHead">Kostnad</div>
            {maintenance.map((row) => (
              <div className="planRow" key={row.component}>
                <div className="componentName">{row.component}</div>
                {years.map((year) => (
                  <div className="cell" key={`${row.component}-${year}`}>
                    {row.years.includes(year) && <span />}
                  </div>
                ))}
                <div className="cost">{row.cost}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bottomGrid">
          <article className="panel">
            <div className="panelTitle">
              <h3>Komponentregister</h3>
              <span>Kopplat till fastighet och Husrapport</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>System</th>
                  <th>Komponent</th>
                  <th>Plats</th>
                  <th>År</th>
                  <th>Status</th>
                  <th>Estimat</th>
                </tr>
              </thead>
              <tbody>
                {components.map((row) => (
                  <tr key={row.join("-")}>
                    {row.map((cell, index) => (
                      <td key={cell} className={index === 4 ? `state ${cell.toLowerCase()}` : ""}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="panel mobileJournal">
            <div className="panelTitle">
              <h3>Mobil platskontroll</h3>
              <span>För montör och bilddokumentation</span>
            </div>
            <div className="device">
              <div className="deviceHeader">Husrapport</div>
              <button>Öppna kundunderlag</button>
              <button>Verifiera komponent</button>
              <button>Ta bild</button>
              <button>Uppdatera åtgärdsplan</button>
              <button>Skapa rapportutkast</button>
            </div>
          </article>
        </section>

        <footer className="reportFooter">
          <span>GDPR · Audit log · Rollbaserad åtkomst · Kunduppgift eller verifierad uppgift</span>
          <strong>Rehn VVS</strong>
        </footer>
      </section>
    </main>
  );
}
