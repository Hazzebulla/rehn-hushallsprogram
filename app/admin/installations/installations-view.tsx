"use client";

import { useMemo, useState, useTransition } from "react";
import { createComponentAction, type ComponentVm, type InstallationPropertyOption } from "./actions";

const statusOrder = ["RED", "ORANGE", "YELLOW", "GREEN", "GREY"];

export default function InstallationsView({
  databaseOnline,
  properties,
  components,
}: {
  databaseOnline: boolean;
  properties: InstallationPropertyOption[];
  components: ComponentVm[];
}) {
  const [items] = useState(components);
  const [message, setMessage] = useState(
    databaseOnline ? "Installationer läses från databasen." : "Databasen är offline. Visar demokomponenter.",
  );
  const [isPending, startTransition] = useTransition();

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)),
    [items],
  );
  const riskCount = items.filter((item) => item.riskLevel === "HIGH" || item.status === "RED").length;
  const totalCost = items.reduce((total, item) => total + item.replacementCostKr, 0);
  const nextReplacement = sortedItems.find((item) => item.plannedReplacementYear)?.plannedReplacementYear ?? "-";

  function createComponent(formData: FormData) {
    startTransition(async () => {
      const result = await createComponentAction(formData);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Installationsregister</p>
          <h1>Komponenterna som driver husrapport, risk och 20-årsplan.</h1>
          <p>
            Lägg in värmepump, expansionskärl, ventiler, tappvatten och sanitetsdelar. Varje komponent får
            status, risknivå, livslängd och preliminärt bytesår.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/admin/husstatus-form">Fyll i formulär</a>
          <a className="buttonLink" href="/admin/properties">Fastigheter</a>
          <a className="buttonLink" href="/husrapport">Rapport</a>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel">
          <span>Komponenter</span>
          <strong>{items.length}</strong>
          <small>Registrerade</small>
        </article>
        <article className="portalPanel">
          <span>Hög risk</span>
          <strong>{riskCount}</strong>
          <small>Röd eller hög risk</small>
        </article>
        <article className="portalPanel">
          <span>Nästa byte</span>
          <strong>{nextReplacement}</strong>
          <small>Planerat år</small>
        </article>
        <article className="portalPanel">
          <span>Planerat värde</span>
          <strong>{totalCost.toLocaleString("sv-SE")} kr</strong>
          <small>Preliminärt</small>
        </article>
      </section>

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Ny komponent</h3>
            <span>Kopplas till fastighet och tekniskt system</span>
          </div>
          <form action={createComponent} className="documentForm">
            <label>
              Fastighet
              <select disabled={!databaseOnline || isPending} name="propertyId" required>
                <option value="">Välj fastighet</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}
              </select>
            </label>
            <div className="formSplit">
              <label>
                System
                <input defaultValue="Värmesystem" disabled={!databaseOnline || isPending} name="systemName" required />
              </label>
              <label>
                Kategori
                <select disabled={!databaseOnline || isPending} name="category" defaultValue="Värmesystem">
                  <option>Värmesystem</option>
                  <option>Tappvatten</option>
                  <option>Sanitet</option>
                  <option>El & styr</option>
                  <option>Avlopp</option>
                </select>
              </label>
            </div>
            <label>
              Komponenttyp
              <input disabled={!databaseOnline || isPending} name="typeName" placeholder="Expansionskärl" required />
            </label>
            <div className="formSplit">
              <label>
                Fabrikat
                <input disabled={!databaseOnline || isPending} name="brand" placeholder="Reflex" />
              </label>
              <label>
                Modell
                <input disabled={!databaseOnline || isPending} name="model" placeholder="N 18" />
              </label>
            </div>
            <div className="formSplit">
              <label>
                Installerad år
                <input disabled={!databaseOnline || isPending} name="installedYear" placeholder="2010" type="number" />
              </label>
              <label>
                Normal livslängd
                <input defaultValue="15" disabled={!databaseOnline || isPending} name="normalLifeYears" type="number" />
              </label>
            </div>
            <label>
              Serie-/ID-nr
              <input disabled={!databaseOnline || isPending} name="serialNo" />
            </label>
            <div className="formSplit">
              <label>
                Status
                <select disabled={!databaseOnline || isPending} name="status" defaultValue="GREEN">
                  <option value="GREEN">Grön</option>
                  <option value="YELLOW">Gul</option>
                  <option value="ORANGE">Orange</option>
                  <option value="RED">Röd</option>
                  <option value="GREY">Okänd</option>
                </select>
              </label>
              <label>
                Risk
                <select disabled={!databaseOnline || isPending} name="riskLevel" defaultValue="LOW">
                  <option value="LOW">Låg</option>
                  <option value="MEDIUM">Medel</option>
                  <option value="HIGH">Hög</option>
                </select>
              </label>
            </div>
            <div className="formSplit">
              <label>
                Skick
                <input defaultValue="OK" disabled={!databaseOnline || isPending} name="condition" />
              </label>
              <label>
                Kritikalitet
                <select disabled={!databaseOnline || isPending} name="criticality" defaultValue="NORMAL">
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">Hög</option>
                </select>
              </label>
            </div>
            <label>
              Byteskostnad kr
              <input disabled={!databaseOnline || isPending} name="replacementCostKr" placeholder="7500" type="number" />
            </label>
            <button disabled={!databaseOnline || isPending}>Spara komponent</button>
          </form>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Varför detta är Fas 1</h3>
            <span>Grunden för RVM Husstatus</span>
          </div>
          <div className="documentRules">
            <div><strong>Status</strong><span>Grön, gul, orange, röd eller okänd styr rapportens prioritet.</span></div>
            <div><strong>Livslängd</strong><span>Installerat år + normal livslängd ger planerat bytesår.</span></div>
            <div><strong>Risk</strong><span>Risk och kritikalitet gör kundportalen konkret.</span></div>
            <div><strong>Historik</strong><span>Varje ny komponent loggas i audit-loggen.</span></div>
          </div>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Komponentregister</h3>
          <span>{items.length} komponenter</span>
        </div>
        <div className="componentRegistry">
          {sortedItems.map((component) => (
            <article className={`status-${component.status.toLowerCase()}`} key={component.id}>
              <div>
                <span>{component.propertyName}</span>
                <strong>{component.typeName}</strong>
                <small>{component.systemName} · {component.category}</small>
              </div>
              <div>
                <span>Fabrikat / modell</span>
                <strong>{component.brand} {component.model}</strong>
                <small>{component.serialNo}</small>
              </div>
              <div>
                <span>Livslängd</span>
                <strong>{component.installedYear} + {component.normalLifeYears} år</strong>
                <small>Plan: {component.plannedReplacementYear ?? "-"}</small>
              </div>
              <div>
                <span>Risk</span>
                <strong>{component.status}</strong>
                <small>{component.riskLevel} · {component.condition}</small>
              </div>
              <b>{component.replacementCostKr.toLocaleString("sv-SE")} kr</b>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
