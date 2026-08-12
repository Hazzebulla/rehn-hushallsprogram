"use client";

import { useMemo, useState, useTransition } from "react";
import { createPropertyAction, type PropertyCustomerOption, type PropertyVm } from "./actions";

export default function PropertiesView({
  properties,
  customers,
  databaseOnline,
}: {
  properties: PropertyVm[];
  customers: PropertyCustomerOption[];
  databaseOnline: boolean;
}) {
  const [items] = useState(properties);
  const [selectedId, setSelectedId] = useState(properties[0]?.id ?? "");
  const [message, setMessage] = useState(
    databaseOnline ? "Fastighetsregistret läses från databasen." : "Databasen är offline. Visar demofastigheter.",
  );
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => items.find((property) => property.id === selectedId) ?? items[0],
    [items, selectedId],
  );
  const selectedReportUrl = selected?.id ? `/husrapport?propertyId=${selected.id}` : "/husrapport";

  const averageHealth = items.length
    ? Math.round(items.reduce((total, property) => total + property.health, 0) / items.length)
    : 0;
  const highRisk = items.filter((property) => property.risk >= 50).length;
  const documentCount = items.reduce((total, property) => total + property.documents, 0);

  function createProperty(formData: FormData) {
    startTransition(async () => {
      const result = await createPropertyAction(formData);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Fastighetsregister</p>
          <h1>Fastigheten är navet mellan kund, husrapport och arbetsflöde.</h1>
          <p>
            Här samlas adress, typ, byggår, risk, teknisk status och kopplingar. Senare fyller vi på med rum,
            system och komponentregister direkt från husstatusgenomgången.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href={selectedReportUrl}>Status Husrapport</a>
          <a className="buttonLink" href="/admin/documents">Dokument</a>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel">
          <span>Fastigheter</span>
          <strong>{items.length}</strong>
          <small>Registrerade objekt</small>
        </article>
        <article className="portalPanel">
          <span>Teknisk status</span>
          <strong>{averageHealth}</strong>
          <small>Snitt av 100</small>
        </article>
        <article className="portalPanel">
          <span>Hög risk</span>
          <strong>{highRisk}</strong>
          <small>Behöver följas upp</small>
        </article>
        <article className="portalPanel">
          <span>Dokument</span>
          <strong>{documentCount}</strong>
          <small>Kopplade filer</small>
        </article>
      </section>

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Ny fastighet</h3>
            <span>Kopplas till befintlig kund</span>
          </div>
          <form action={createProperty} className="documentForm">
            <label>
              Kund
              <select disabled={!databaseOnline || isPending} name="customerId" required>
                <option value="">Välj kund</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label>
              Fastighet
              <input disabled={!databaseOnline || isPending} name="propertyNo" placeholder="Villa Ängby" required />
            </label>
            <div className="formSplit">
              <label>
                Typ
                <select disabled={!databaseOnline || isPending} name="type" defaultValue="Villa">
                  <option>Villa</option>
                  <option>BRF</option>
                  <option>Fritidshus</option>
                  <option>Kommersiell</option>
                </select>
              </label>
              <label>
                Byggår
                <input disabled={!databaseOnline || isPending} name="buildYear" type="number" placeholder="1978" />
              </label>
            </div>
            <label>
              Adress
              <input disabled={!databaseOnline || isPending} name="address" placeholder="Björkvägen 12, Bromma" required />
            </label>
            <div className="formSplit">
              <label>
                Status
                <input defaultValue="74" disabled={!databaseOnline || isPending} max="100" min="0" name="health" type="number" />
              </label>
              <label>
                Risk
                <input defaultValue="28" disabled={!databaseOnline || isPending} max="100" min="0" name="risk" type="number" />
              </label>
            </div>
            <label>
              Värmekälla
              <input disabled={!databaseOnline || isPending} name="heating" placeholder="Bergvärme" />
            </label>
            <label>
              Nästa åtgärd
              <input disabled={!databaseOnline || isPending} name="nextAction" placeholder="Första husstatusgenomgång" />
            </label>
            <button disabled={!databaseOnline || isPending}>Spara fastighet</button>
          </form>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Vald fastighet</h3>
            <span>{selected?.customerName ?? "Ingen vald"}</span>
          </div>
          {selected ? (
            <div className="propertyDetail">
              <strong>{selected.propertyNo}</strong>
              <span>{selected.address}</span>
              <div>
                <b>{selected.type}</b>
                <b>{selected.buildYear ?? "Byggår saknas"}</b>
              </div>
              <div className="liveScore compact">
                <div className="scoreOrb">
                  <strong>{selected.health}</strong>
                  <span>/100</span>
                </div>
                <div>
                  <b>{selected.risk}% risk</b>
                  <small>{selected.nextAction}</small>
                </div>
              </div>
              <div className="portalActions">
                <a className="buttonLink" href={`/admin/husstatus-form?propertyId=${selected.id}`}>Fyll i formulär</a>
                <a className="buttonLink" href={selectedReportUrl}>Rapport</a>
                <a className="buttonLink" href="/portal">Portal</a>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Fastigheter</h3>
          <span>{items.length} objekt</span>
        </div>
        <div className="propertyList">
          {items.map((property) => (
            <button
              className={property.id === selected?.id ? "active" : ""}
              key={property.id}
              onClick={() => setSelectedId(property.id)}
            >
              <span>{property.customerName}</span>
              <strong>{property.propertyNo}</strong>
              <small>{property.address}</small>
              <b>{property.health}/100 · {property.risk}% risk</b>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
