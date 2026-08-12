"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { createCustomerAction, publishCustomerToPortalAction, type CustomerVm } from "./actions";

const seedCustomers: CustomerVm[] = [
  {
    id: "K-1001",
    name: "Anna & Erik Svensson",
    email: "anna.svensson@example.se",
    phone: "070-123 45 67",
    property: "Villa Ängby",
    address: "Björkvägen 12, Bromma",
    type: "Villa",
    heating: "Bergvärme",
    risk: 28,
    health: 74,
    nextAction: "Byt expansionskärl",
    status: "Publicerad portal",
  },
  {
    id: "K-1002",
    name: "BRF Solglimten",
    email: "styrelse@solglimten.se",
    phone: "08-410 22 10",
    property: "Flerbostadshus Nacka",
    address: "Solvägen 4-8, Nacka",
    type: "BRF",
    heating: "Fjärrvärme",
    risk: 41,
    health: 63,
    nextAction: "Inventera undercentral",
    status: "Intern granskning",
  },
];

const emptyCustomer: Omit<CustomerVm, "id" | "risk" | "health" | "status"> = {
  name: "",
  email: "",
  phone: "",
  property: "",
  address: "",
  type: "Villa",
  heating: "Bergvärme",
  nextAction: "",
};

export default function CustomerRegister({
  initialCustomers,
  databaseOnline,
}: {
  initialCustomers: CustomerVm[];
  databaseOnline: boolean;
}) {
  const startingCustomers = initialCustomers.length > 0 ? initialCustomers : seedCustomers;
  const [customers, setCustomers] = useState<CustomerVm[]>(startingCustomers);
  const [selectedId, setSelectedId] = useState(startingCustomers[0].id);
  const [form, setForm] = useState(emptyCustomer);
  const [message, setMessage] = useState(
    databaseOnline ? "Databasen är kopplad." : "Databasen är offline. Demosidan använder lokal fallback.",
  );
  const [isPending, startTransition] = useTransition();

  const selected = useMemo(
    () => customers.find((customer) => customer.id === selectedId) ?? customers[0],
    [customers, selectedId],
  );

  function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createCustomerAction(form);
      const next: CustomerVm =
        result.ok
          ? result.customer
          : {
              ...form,
              id: `LOCAL-${1000 + customers.length + 1}`,
              risk: form.type === "BRF" ? 36 : 22,
              health: form.type === "BRF" ? 68 : 79,
              status: "Lokalt utkast",
            };

      setCustomers((current) => [next, ...current]);
      setSelectedId(next.id);
      setForm(emptyCustomer);
      setMessage(result.message);
    });
  }

  function publishToPortal() {
    startTransition(async () => {
      const result = await publishCustomerToPortalAction(selected.id);
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === selected.id
            ? { ...(result.ok ? result.customer : customer), status: "Publicerad portal" }
            : customer,
        ),
      );
      setMessage(result.message);
    });
  }

  return (
    <section className="adminWork customerWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Kundregister</p>
          <h1>Lägg in kund, fastighet och första husstatusdata.</h1>
          <p>
            Admin matar in kunden först. Samma post kan sedan skapa kundkonto,
            första genomgång, rapport, offert och arbetsorder.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/portal">Visa kundportal</a>
          <a className="buttonLink" href="/husrapport">Visa rapport</a>
        </div>
      </header>

      <section className="customerOps">
        <form className="portalPanel customerForm" onSubmit={addCustomer}>
          <div className="panelTitle">
            <h3>Ny kund</h3>
            <span>Grunddata för konto och journal</span>
          </div>
          <label>
            Kundnamn
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            E-post
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            Telefon
            <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label>
            Fastighet
            <input value={form.property} onChange={(event) => setForm({ ...form, property: event.target.value })} required />
          </label>
          <label>
            Adress
            <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required />
          </label>
          <div className="formSplit">
            <label>
              Typ
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option>Villa</option>
                <option>Radhus</option>
                <option>BRF</option>
                <option>Kommersiell</option>
              </select>
            </label>
            <label>
              Värmekälla
              <select value={form.heating} onChange={(event) => setForm({ ...form, heating: event.target.value })}>
                <option>Bergvärme</option>
                <option>Fjärrvärme</option>
                <option>Luft/vatten</option>
                <option>Frånluftsvärmepump</option>
              </select>
            </label>
          </div>
          <label>
            Första rekommenderade åtgärd
            <input value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} required />
          </label>
          <button className="submitButton" disabled={isPending}>
            {isPending ? "Sparar..." : "Skapa kund och journalutkast"}
          </button>
        </form>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Kunder</h3>
            <span>{customers.length} poster</span>
          </div>
          <div className="customerList">
            {customers.map((customer) => (
              <button
                className={customer.id === selected.id ? "selected" : ""}
                key={customer.id}
                onClick={() => setSelectedId(customer.id)}
                type="button"
              >
                <strong>{customer.name}</strong>
                <span>{customer.property} · {customer.status}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      {selected && (
        <section className="customerDetail">
          <article className="portalPanel healthPanel">
            <p className="sectionKicker">{selected.id}</p>
            <h1>{selected.property}</h1>
            <p>{selected.name} · {selected.address} · {selected.type} · {selected.heating}</p>
            <div className="liveScore">
              <div className="scoreOrb">
                <strong>{selected.health}</strong>
                <span>/100</span>
              </div>
              <div>
                <b>Riskindex {selected.risk}% och ökar om åtgärd inte utförs</b>
                <span className="liveLine"><i /></span>
                <small>Nästa rekommendation: {selected.nextAction}</small>
              </div>
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Nästa steg</h3>
              <span>Skapar länkar i SaaS-flödet</span>
            </div>
            <div className="nextSteps">
              <button disabled={isPending} onClick={publishToPortal} type="button">
                {isPending ? "Publicerar..." : "Publicera till kundportal"}
              </button>
              <button type="button">Skapa första VVS-genomgång</button>
              <button type="button">Skapa offert från åtgärd</button>
              <button type="button">Skapa arbetsorder</button>
            </div>
          </article>
        </section>
      )}
    </section>
  );
}
