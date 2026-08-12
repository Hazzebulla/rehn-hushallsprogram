"use client";

import { useState, useTransition } from "react";
import { createGdprRequestAction, verifyGdprRequestAction } from "./actions";
import type { GdprCustomer, GdprVm } from "./page";

export default function GdprView({
  databaseOnline,
  requests,
  customers,
}: {
  databaseOnline: boolean;
  requests: GdprVm[];
  customers: GdprCustomer[];
}) {
  const [items, setItems] = useState(requests);
  const [message, setMessage] = useState(
    databaseOnline ? "GDPR-ärenden läses från databasen." : "Databasen är offline. GDPR kan inte sparas.",
  );
  const [isPending, startTransition] = useTransition();

  function createRequest(formData: FormData) {
    startTransition(async () => {
      const result = await createGdprRequestAction(formData);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  function verify(requestId: string) {
    startTransition(async () => {
      const result = await verifyGdprRequestAction(requestId);
      if (result.ok) {
        setItems((current) =>
          current.map((item) => (item.id === requestId ? { ...item, status: "VERIFYING_IDENTITY" } : item)),
        );
      }
      setMessage(result.message);
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">GDPR</p>
          <h1>Export, rättning och radering som styrda ärenden.</h1>
          <p>
            GDPR-flödet ska inte vara en lös knapp. Varje begäran skapas, identitet kontrolleras och allt loggas.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
      </header>

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Nytt GDPR-ärende</h3>
            <span>Kräver identitetskontroll innan åtgärd</span>
          </div>
          <form action={createRequest} className="documentForm">
            <label>
              Kund
              <select disabled={!databaseOnline || isPending} name="customerId">
                <option value="">Ingen kund vald</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label>
              Typ
              <select disabled={!databaseOnline || isPending} name="type">
                <option value="EXPORT">Export</option>
                <option value="RECTIFY">Rättning</option>
                <option value="DELETE">Radering</option>
              </select>
            </label>
            <label>
              Notering
              <input disabled={!databaseOnline || isPending} name="notes" placeholder="Vad kunden begär" />
            </label>
            <button disabled={!databaseOnline || isPending}>Skapa ärende</button>
          </form>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Regler</h3>
            <span>Simpelt och spårbart</span>
          </div>
          <div className="documentRules">
            <div><strong>Export</strong><span>Samla persondata innan utlämning.</span></div>
            <div><strong>Rättning</strong><span>Ändra felaktiga uppgifter och logga före/efter.</span></div>
            <div><strong>Radering</strong><span>Kontrollera bokföring, avtal och garanti innan radering.</span></div>
          </div>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Ärenden</h3>
          <span>{items.length} GDPR-ärenden</span>
        </div>
        <div className="opsTable">
          {items.map((request) => (
            <article key={request.id}>
              <strong>{request.type}</strong>
              <span>{request.customerName}</span>
              <span>{request.notes}</span>
              <b>{request.status}</b>
              <time>{request.createdAt}</time>
              <button disabled={!databaseOnline || isPending} onClick={() => verify(request.id)}>ID-kontroll</button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
