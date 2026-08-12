const riskBars = [
  { label: "Värme", value: 84 },
  { label: "Tappvatten", value: 68 },
  { label: "Avlopp", value: 58 },
  { label: "Ventiler", value: 74 },
  { label: "El & styr", value: 43 },
  { label: "Sanitet", value: 39 },
];

const metrics = [
  { label: "Totalt riskindex", value: "28", status: "Låg" },
  { label: "Energipotential", value: "18%", status: "Besparing" },
  { label: "Teknisk status", value: "78%", status: "God" },
  { label: "Aktuella åtgärder", value: "5", status: "Prioriterade" },
];

const recommendations = [
  "Byt expansionskärl inom 1 år",
  "Uppgradera radiatorventiler plan 1",
  "Genomför tryckprovning i värmesystemet",
  "Planera byte av blandningsventil",
  "Samla servicetillfällen per område",
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
  "Kundförfrågan",
  "Offert",
  "Projekt",
  "Arbetsorder",
  "Tid & material",
  "Fakturaunderlag",
];

export default function Page() {
  return (
    <main className="reportShell">
      <nav className="modeNav" aria-label="Demo navigation">
        <a className="active" href="/">Omslag</a>
        <a href="/husrapport">Status Husrapport</a>
        <a href="/portal">Kundkonto</a>
        <a href="/admin">SaaS-system</a>
      </nav>
      <section className="cover">
        <div className="coverTop">
          <div className="stagMark">
            <span />
          </div>
          <div className="seal">20 år<br />journal</div>
        </div>

        <div className="coverTitle">
          <p>Premium SaaS för hantverk</p>
          <h1>RVM Husstatus</h1>
          <span>Koll på projekt, ekonomi och fastighetens framtid.</span>
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
          <div><dt>Projekt</dt><dd>Första VVS-genomgång</dd></div>
          <div><dt>Rapport</dt><dd>HNV-2026-081</dd></div>
        </dl>
      </section>

      <section className="report">
        <header className="reportHeader">
          <div className="brandLine">
            <div className="miniMark" />
            <div>
              <strong>Hantverksnav</strong>
              <span>Husjournal · VVS Demo AB</span>
            </div>
          </div>
          <div className="reportMeta">
            <span>Rapportnummer</span>
            <strong>HNV-2026-081-0001</strong>
          </div>
        </header>

        <section className="summary">
          <div>
            <p className="sectionKicker">Sammanfattning</p>
            <h2>En operativ SaaS-yta med premiumrapport som produktkänsla.</h2>
            <p>
              Vyn samlar projektflöde, arbetsorder, fakturaunderlag, komponentregister,
              riskbedömning och en 20-årig underhållsplan i ett mörkt, tekniskt gränssnitt.
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
              <span>Komponentrisk per tekniskt område</span>
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
              <h3>Rekommendationer</h3>
              <span>Prioriterade åtgärder</span>
            </div>
            <ol className="recommendations">
              {recommendations.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </article>
        </section>

        <section className="panel planPanel">
          <div className="panelTitle">
            <h3>20-årig åtgärds- och investeringsplan</h3>
            <span>Preliminär plan, inte bindande offert eller garanti</span>
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
              <span>Alla rader är tenant-kopplade och versionsloggade</span>
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
              <h3>Mobil fältvy</h3>
              <span>För montör på plats</span>
            </div>
            <div className="device">
              <div className="deviceHeader">Dagens order</div>
              <button>Starta arbetstid</button>
              <button>Registrera komponent</button>
              <button>Ta foto</button>
              <button>Skapa ÄTA</button>
              <button>Avsluta arbetsorder</button>
            </div>
          </article>
        </section>

        <footer className="reportFooter">
          <span>GDPR · Audit log · Rollbaserad åtkomst · Offertversioner låses vid accept</span>
          <strong>VVS Demo AB</strong>
        </footer>
      </section>
    </main>
  );
}
