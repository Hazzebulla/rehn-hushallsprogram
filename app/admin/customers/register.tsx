"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { createCustomerAction, deleteCustomerAction, publishCustomerToPortalAction, type CustomerVm } from "./actions";

const seedCustomers: CustomerVm[] = [
  {
    id: "K-1001",
    name: "Anna & Erik Svensson",
    identifier: "",
    email: "anna.svensson@example.se",
    phone: "070-123 45 67",
    property: "Villa Ängby",
    address: "Björkvägen 12, Bromma",
    type: "Villa",
    buildYear: "1978",
    heating: "Bergvärme",
    profileSourceUrl: "",
    risk: 28,
    health: 74,
    nextAction: "Byt expansionskärl",
    status: "Publicerad portal",
  },
  {
    id: "K-1002",
    name: "BRF Solglimten",
    identifier: "",
    email: "styrelse@solglimten.se",
    phone: "08-410 22 10",
    property: "Flerbostadshus Nacka",
    address: "Solvägen 4-8, Nacka",
    type: "BRF",
    buildYear: "",
    heating: "Fjärrvärme",
    profileSourceUrl: "",
    risk: 41,
    health: 63,
    nextAction: "Inventera undercentral",
    status: "Intern granskning",
  },
];

const emptyCustomer: Omit<CustomerVm, "id" | "risk" | "health" | "status"> = {
  name: "",
  identifier: "",
  email: "",
  phone: "",
  property: "",
  address: "",
  type: "Villa",
  buildYear: "",
  heating: "Bergvärme",
  profileSourceUrl: "",
  nextAction: "",
};

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value.replace(/\s{2,}/g, " ");
  }
  return "";
}

function inferPropertyType(text: string) {
  const normalized = text.toLowerCase();
  if (/brf|bostadsrättsförening|lägenhet/.test(normalized)) return "BRF";
  if (/radhus|kedjehus/.test(normalized)) return "Radhus";
  if (/lokal|kommersiell|industr/i.test(text)) return "Kommersiell";
  return "Villa";
}

function parseProfileText(input: string): Partial<typeof emptyCustomer> {
  const text = input.replace(/\r/g, "\n");
  const compact = text.replace(/\n+/g, " ");

  const identifier = firstMatch(compact, [
    /\b(\d{6}[-+]\d{4})\b/,
    /\b(\d{8}[-+]?\d{4})\b/,
    /\b(\d{6}-\d{4})\b/,
  ]);
  const email = firstMatch(compact, [/\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i]);
  const phone = firstMatch(compact, [
    /\b((?:\+46|0)\s?7\d[\d\s-]{6,})\b/,
    /\b((?:\+46|0)\s?8[\d\s-]{5,})\b/,
    /\b((?:\+46|0)\s?\d{2,4}[\d\s-]{5,})\b/,
  ]);
  const buildYear = firstMatch(compact, [
    /(?:byggår|byggt|uppförd|uppfördes)\D{0,20}((?:18|19|20)\d{2})/i,
  ]);
  const profileSourceUrl = firstMatch(compact, [
    /\b(https?:\/\/(?:www\.)?(?:ratsit|mrkoll)\.se\/[^\s<>"']+)/i,
  ]);
  const property = firstMatch(compact, [
    /(?:fastighetsbeteckning|fastighet)\s*:?\s*([A-ZÅÄÖ0-9 :._-]{3,60})/i,
  ]);
  const address = firstMatch(compact, [
    /(?:adress|folkbokföringsadress|gatuadress)\s*:?\s*([^,;\n]{3,80}(?:,\s*\d{3}\s?\d{2}\s+[A-ZÅÄÖa-zåäö -]+)?)/i,
    /\b([A-ZÅÄÖa-zåäö -]+(?:vägen|gatan|gränd|stigen|allén|backen|torget|platsen)\s+\d+[A-Z]?(?:,\s*\d{3}\s?\d{2}\s+[A-ZÅÄÖa-zåäö -]+)?)/,
  ]);

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const name = firstMatch(compact, [
    /(?:namn|person)\s*:?\s*([A-ZÅÄÖ][A-ZÅÄÖa-zåäö '-]{3,80})/i,
  ]) || lines.find((line) =>
    /^[A-ZÅÄÖ][A-ZÅÄÖa-zåäö '-]{3,80}$/.test(line)
    && !/ratsit|mr\s?koll|adress|telefon|fastighet|personnummer/i.test(line)
  ) || "";

  return {
    name,
    identifier,
    email,
    phone,
    property: property || address || "",
    address,
    type: inferPropertyType(compact),
    buildYear,
    profileSourceUrl,
    nextAction: "Första husstatuskontroll",
  };
}

function mergeParsedCustomer(
  current: typeof emptyCustomer,
  parsed: Partial<typeof emptyCustomer>,
) {
  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => String(value ?? "").trim().length > 0),
    ),
  };
}

function inputValue(value: unknown) {
  return String(value ?? "");
}

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
  const [profileText, setProfileText] = useState("");
  const [showProfileImport, setShowProfileImport] = useState(false);
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

  function importProfile() {
    const parsed = parseProfileText(profileText);
    setForm((current) => mergeParsedCustomer(current, parsed));
    const importedKeys = Object.entries(parsed).filter(([, value]) => String(value ?? "").trim()).length;
    setMessage(importedKeys > 0
      ? `Underlaget tolkades och ${importedKeys} fält fylldes i. Kontrollera innan du sparar.`
      : "Ingen tydlig kunddata hittades. Klistra in hela profilen eller fyll manuellt.");
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

  function deleteCustomer(customer: CustomerVm) {
    const confirmed = window.confirm(
      `Radera ${customer.name}?\n\nKunden, fastigheten, husrapportdata och kundens bilder tas bort. Projekt och accepterade offerter stoppar raderingen.`,
    );
    if (!confirmed) return;

    if (customer.id.startsWith("LOCAL-") || !databaseOnline) {
      const nextCustomers = customers.filter((item) => item.id !== customer.id);
      setCustomers(nextCustomers);
      setSelectedId(nextCustomers[0]?.id ?? "");
      setMessage("Lokal demokund raderades.");
      return;
    }

    startTransition(async () => {
      const result = await deleteCustomerAction(customer.id);
      if (result.ok) {
        const nextCustomers = customers.filter((item) => item.id !== result.deletedCustomerId);
        setCustomers(nextCustomers);
        setSelectedId(nextCustomers[0]?.id ?? "");
      }
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
            första genomgång, Huscheck, rapportutkast och åtgärdsplan.
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
          <div className="profileImportBox">
            <button type="button" onClick={() => setShowProfileImport((current) => !current)}>
              {showProfileImport ? "Dölj profilimport" : "Klistra in Ratsit/MrKoll-underlag"}
            </button>
            {showProfileImport ? (
              <div className="profileImportPanel">
                <label>
                  Profiltext eller länk + kopierad information
                  <textarea
                    onChange={(event) => setProfileText(event.target.value)}
                    placeholder="Klistra in profiltext med namn, personnummer/orgnr, adress, fastighetsbeteckning, byggår, telefon och e-post. Kontrollera alltid uppgifterna innan du sparar."
                    rows={7}
                    value={profileText}
                  />
                </label>
                <button type="button" onClick={importProfile}>Fyll från underlag</button>
                <small>
                  Automatisk hämtning från externa profilsidor kräver tillåtet API/avtal. Här tolkar appen bara texten som ni själva klistrar in.
                </small>
              </div>
            ) : null}
          </div>
          <label>
            Kundnamn
            <input value={inputValue(form.name)} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            Personnummer / organisationsnummer
            <input value={inputValue(form.identifier)} onChange={(event) => setForm({ ...form, identifier: event.target.value })} />
          </label>
          <label>
            E-post
            <input type="email" value={inputValue(form.email)} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            Telefon
            <input value={inputValue(form.phone)} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </label>
          <label>
            Fastighet
            <input value={inputValue(form.property)} onChange={(event) => setForm({ ...form, property: event.target.value })} required />
          </label>
          <label>
            Adress
            <input value={inputValue(form.address)} onChange={(event) => setForm({ ...form, address: event.target.value })} required />
          </label>
          <label>
            Underlagslänk
            <input value={inputValue(form.profileSourceUrl)} onChange={(event) => setForm({ ...form, profileSourceUrl: event.target.value })} placeholder="https://www.ratsit.se/..." />
          </label>
          <div className="formSplit">
            <label>
              Typ
              <select value={inputValue(form.type) || "Villa"} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                <option>Villa</option>
                <option>Radhus</option>
                <option>BRF</option>
                <option>Kommersiell</option>
              </select>
            </label>
            <label>
              Byggår
              <input inputMode="numeric" value={inputValue(form.buildYear)} onChange={(event) => setForm({ ...form, buildYear: event.target.value.replace(/[^\d]/g, "").slice(0, 4) })} />
            </label>
          </div>
          <div className="formSplit">
            <label>
              Värmekälla
              <select value={inputValue(form.heating) || "Bergvärme"} onChange={(event) => setForm({ ...form, heating: event.target.value })}>
                <option>Bergvärme</option>
                <option>Fjärrvärme</option>
                <option>Luft/vatten</option>
                <option>Frånluftsvärmepump</option>
              </select>
            </label>
          </div>
          <label>
            Första rekommenderade åtgärd
            <input value={inputValue(form.nextAction)} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} required />
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
              <div className={customer.id === selected?.id ? "customerListItem selected" : "customerListItem"} key={customer.id}>
                <button
                  className={customer.id === selected?.id ? "selected" : ""}
                  onClick={() => setSelectedId(customer.id)}
                  type="button"
                >
                  <strong>{customer.name}</strong>
                  <span>{customer.property} · {customer.status}</span>
                </button>
                <button
                  className="deleteCustomerButton"
                  disabled={isPending}
                  onClick={() => deleteCustomer(customer)}
                  type="button"
                >
                  Radera
                </button>
              </div>
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
            <p>{[selected.identifier, selected.buildYear ? `Byggår ${selected.buildYear}` : ""].filter(Boolean).join(" · ")}</p>
            {selected.profileSourceUrl ? <p>Underlag: {selected.profileSourceUrl}</p> : null}
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
              <span>Skapar länkar i husrapportflödet</span>
            </div>
            <div className="nextSteps">
              <button disabled={isPending} onClick={publishToPortal} type="button">
                {isPending ? "Publicerar..." : "Publicera till kundportal"}
              </button>
              <button type="button">Starta VVS-genomgång</button>
              <button type="button">Öppna Huscheck</button>
              <button type="button">Skapa åtgärdsunderlag</button>
            </div>
          </article>
        </section>
      )}
    </section>
  );
}
