"use client";

import { useState, useTransition } from "react";
import { importReportPdfAction } from "./actions";

type PropertyOption = {
  id: string;
  label: string;
};

export default function ReportImportView({
  databaseOnline,
  properties,
}: {
  databaseOnline: boolean;
  properties: PropertyOption[];
}) {
  const [message, setMessage] = useState(
    databaseOnline ? "Välj fastighet och ladda upp ifyllt PDF-formulär." : "Databasen är offline. Import kan inte sparas.",
  );
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function importPdf(formData: FormData) {
    startTransition(async () => {
      const result = await importReportPdfAction(formData);
      setMessage(result.message);
      setWarnings(result.ok ? result.warnings ?? [] : []);
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">PDF till husrapport</p>
          <h1>Ladda upp ert ifyllda formulär och fyll husrapporten automatiskt.</h1>
          <p>
            Första versionen läser textbaserade och ifyllbara PDF:er. Den sparar originalet, skapar inspektion,
            plockar ut status/risk/åtgärder och skapar komponenter när formulärets rader går att tolka.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Läser PDF..." : message}
          </div>
          {warnings.length ? (
            <div className="importWarnings">
              {warnings.map((warning) => <span key={warning}>{warning}</span>)}
            </div>
          ) : null}
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/admin/installations">Installationer</a>
          <a className="buttonLink" href="/husrapport">Husrapport</a>
        </div>
      </header>

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Importera formulär</h3>
            <span>PDF sparas internt som original</span>
          </div>
          <form action={importPdf} className="documentForm">
            <label>
              Fastighet
              <select disabled={!databaseOnline || isPending} name="propertyId" required>
                <option value="">Välj fastighet</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}
              </select>
            </label>
            <label>
              Ifyllt PDF-formulär
              <input accept="application/pdf,.pdf" disabled={!databaseOnline || isPending} name="file" type="file" required />
            </label>
            <button disabled={!databaseOnline || isPending}>Läs in PDF</button>
          </form>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Så kopplas importen</h3>
            <span>Från fält till husrapport</span>
          </div>
          <div className="documentRules">
            <div><strong>Original</strong><span>PDF:en sparas som internt dokument med checksumma.</span></div>
            <div><strong>Inspektion</strong><span>En `Inspection` och `FormSubmission` skapas för spårbarhet.</span></div>
            <div><strong>Fastighetsstatus</strong><span>Status, risk, värmekälla och nästa åtgärd uppdaterar husjournalen.</span></div>
            <div><strong>Komponenter</strong><span>Rader som expansionskärl, värmepump och ventiler blir komponenter.</span></div>
          </div>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Rubriker systemet läser bäst</h3>
          <span>Kan anpassas exakt efter ert färdiga formulär</span>
        </div>
        <div className="importMapping">
          {[
            ["Kund / Beställare", "customerName"],
            ["Fastighet / Objekt / Anläggning", "propertyName"],
            ["Adress", "address"],
            ["Byggår", "buildYear"],
            ["Värmekälla / Uppvärmning", "heating"],
            ["Teknisk status / Husstatus", "health"],
            ["Riskindex / Total risk", "risk"],
            ["Nästa åtgärd / Rekommenderad åtgärd", "nextAction"],
            ["Komponentrader", "type, status, risk, år, kostnad"],
          ].map(([label, field]) => (
            <div key={label}>
              <strong>{label}</strong>
              <span>{field}</span>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
