"use client";

import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { createCustomerAction, deleteCustomerAction, publishCustomerToPortalAction, type CustomerInput, type CustomerVm } from "./actions";

type CustomerKind = "PRIVATE" | "COMPANY";
type CustomerFormState = CustomerInput & {
  customerKind: CustomerKind;
  firstName: string;
  lastName: string;
  companyName: string;
  contactFirstName: string;
  contactLastName: string;
  propertyName: string;
  streetAddress: string;
};

const seedCustomers: CustomerVm[] = [
  {
    id: "K-1001",
    customerNumber: "100001",
    name: "Anna & Erik Svensson",
    identifier: "",
    email: "anna.svensson@example.se",
    phone: "070-123 45 67",
    property: "Villa Ängby",
    address: "Björkvägen 12, Bromma",
    postalCode: "",
    city: "",
    type: "Villa",
    buildYear: "1978",
    heating: "Bergvärme",
    profileSourceUrl: "",
    risk: 28,
    health: 74,
    nextAction: "Byt expansionskärl",
    status: "Publicerad portal",
    createdAt: "2026-08-01",
    updatedAt: "2026-08-27",
    propertyCount: 1,
    reportCount: 1,
    latestReportId: "",
    latestReportDate: "2026-08-27",
    properties: [],
  },
  {
    id: "K-1002",
    customerNumber: "100002",
    name: "BRF Solglimten",
    identifier: "",
    email: "styrelse@solglimten.se",
    phone: "08-410 22 10",
    property: "Flerbostadshus Nacka",
    address: "Solvägen 4-8, Nacka",
    postalCode: "",
    city: "",
    type: "BRF",
    buildYear: "",
    heating: "Fjärrvärme",
    profileSourceUrl: "",
    risk: 41,
    health: 63,
    nextAction: "Inventera undercentral",
    status: "Intern granskning",
    createdAt: "2026-08-01",
    updatedAt: "2026-08-26",
    propertyCount: 1,
    reportCount: 0,
    latestReportId: "",
    latestReportDate: "",
    properties: [],
  },
];

const emptyCustomer: CustomerFormState = {
  customerKind: "PRIVATE",
  firstName: "",
  lastName: "",
  companyName: "",
  contactFirstName: "",
  contactLastName: "",
  name: "",
  identifier: "",
  email: "",
  phone: "",
  property: "",
  address: "",
  postalCode: "",
  city: "",
  propertyName: "",
  streetAddress: "",
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

const statusOptions = [
  "Alla",
  "Utkast",
  "Kundformulär påbörjat",
  "Kundformulär klart",
  "Besök bokat",
  "Pågående besiktning",
  "Väntar på granskning",
  "Publicerad portal",
  "Arkiverad",
];

const sortOptions = [
  "Senast ändrad",
  "Senast skapad",
  "Kundnamn A-Ö",
  "Kundnamn Ö-A",
  "Kundnummer",
  "Adress",
] as const;

function normal(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}

function isValidEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  return /^(\+46|0)[\d\s-]{6,}$/.test(value.trim());
}

function isValidIdentifier(value: string) {
  return !value || /^(\d{6}[-+]?\d{4}|\d{8}[-+]?\d{4}|\d{6}-\d{4})$/.test(value.replace(/\s/g, ""));
}

function isValidPostalCode(value: string) {
  return !value || /^\d{3}\s?\d{2}$/.test(value.trim());
}

function isValidBuildYear(value: string) {
  if (!value) return true;
  const year = Number(value);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= 1800 && year <= currentYear + 1;
}

function fieldErrors(form: CustomerFormState) {
  const errors: Record<string, string> = {};
  if (form.customerKind === "PRIVATE") {
    if (!form.firstName.trim()) errors.firstName = "Förnamn krävs.";
    if (!form.lastName.trim()) errors.lastName = "Efternamn krävs.";
  } else if (!form.companyName.trim()) {
    errors.companyName = "Företagsnamn krävs.";
  }
  if (!form.phone.trim()) errors.phone = "Telefon krävs.";
  if (!isValidPhone(form.phone)) errors.phone = "Ange ett svenskt telefonnummer.";
  if (!isValidEmail(form.email)) errors.email = "Ange en giltig e-postadress.";
  if (!isValidIdentifier(form.identifier)) errors.identifier = "Kontrollera person-/organisationsnummer.";
  if (!form.streetAddress.trim()) errors.streetAddress = "Gatuadress krävs.";
  if (!isValidPostalCode(form.postalCode)) errors.postalCode = "Ange postnummer med 5 siffror.";
  if (!isValidBuildYear(form.buildYear)) errors.buildYear = "Byggår måste vara rimligt.";
  return errors;
}

function customerNameFromForm(form: CustomerFormState) {
  if (form.customerKind === "COMPANY") return form.companyName.trim();
  return `${form.firstName} ${form.lastName}`.replace(/\s+/g, " ").trim();
}

function propertyAddressFromForm(form: CustomerFormState) {
  return [form.streetAddress, [form.postalCode, form.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Alla");
  const [sortBy, setSortBy] = useState<(typeof sortOptions)[number]>("Senast ändrad");
  const [openMenuId, setOpenMenuId] = useState("");
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [message, setMessage] = useState(
    databaseOnline ? "Databasen är kopplad." : "Databasen är offline. Demosidan använder lokal fallback.",
  );
  const [isPending, startTransition] = useTransition();
  const errors = useMemo(() => fieldErrors(form), [form]);

  const selected = useMemo(
    () => customers.find((customer) => customer.id === selectedId) ?? customers[0],
    [customers, selectedId],
  );

  const possibleDuplicate = useMemo(() => {
    const name = normal(customerNameFromForm(form));
    const address = normal(propertyAddressFromForm(form));
    return customers.find((customer) => {
      const sameIdentifier = form.identifier && normal(customer.identifier) === normal(form.identifier);
      const sameEmail = form.email && normal(customer.email) === normal(form.email);
      const samePhone = form.phone && normal(customer.phone).replace(/\D/g, "") === normal(form.phone).replace(/\D/g, "");
      const sameNameAndAddress = name && address && normal(customer.name) === name && normal(customer.address) === address;
      return sameIdentifier || sameEmail || samePhone || sameNameAndAddress;
    });
  }, [customers, form]);

  const filteredCustomers = useMemo(() => {
    const q = normal(query);
    const filtered = customers.filter((customer) => {
      const haystack = [
        customer.customerNumber,
        customer.name,
        customer.identifier,
        customer.email,
        customer.phone,
        customer.property,
        customer.address,
        customer.type,
        customer.status,
        ...customer.properties.flatMap((property) => [property.label, property.address, property.type]),
      ].map(normal).join(" ");
      const matchesSearch = !q || haystack.includes(q);
      const matchesStatus = statusFilter === "Alla" || customer.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "Kundnamn A-Ö") return a.name.localeCompare(b.name, "sv");
      if (sortBy === "Kundnamn Ö-A") return b.name.localeCompare(a.name, "sv");
      if (sortBy === "Kundnummer") return a.customerNumber.localeCompare(b.customerNumber, "sv", { numeric: true });
      if (sortBy === "Adress") return a.address.localeCompare(b.address, "sv");
      if (sortBy === "Senast skapad") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [customers, query, sortBy, statusFilter]);

  useEffect(() => {
    const saved = window.localStorage.getItem("rvm_customer_draft_v2");
    if (!saved) return;
    try {
      setForm({ ...emptyCustomer, ...JSON.parse(saved) });
    } catch {
      window.localStorage.removeItem("rvm_customer_draft_v2");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("rvm_customer_draft_v2", JSON.stringify(form));
  }, [form]);

  function addCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentErrors = fieldErrors(form);
    if (Object.keys(currentErrors).length > 0) {
      setMessage("Kontrollera markerade fält innan kunden sparas.");
      return;
    }

    if (possibleDuplicate && !allowDuplicate) {
      setSelectedId(possibleDuplicate.id);
      setMessage("Möjlig befintlig kund hittades. Öppna kunden eller välj Skapa ändå.");
      return;
    }

    const payload: CustomerInput = {
      name: customerNameFromForm(form),
      identifier: form.identifier.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      property: form.propertyName.trim() || form.streetAddress.trim(),
      address: propertyAddressFromForm(form),
      postalCode: form.postalCode.trim(),
      city: form.city.trim(),
      type: form.type,
      buildYear: form.buildYear,
      heating: form.heating,
      profileSourceUrl: form.profileSourceUrl.trim(),
      nextAction: form.nextAction.trim() || "Första husstatuskontroll",
    };

    startTransition(async () => {
      const result = await createCustomerAction(payload);
      const next: CustomerVm =
        result.ok
          ? result.customer
          : {
              ...payload,
              id: `LOCAL-${1000 + customers.length + 1}`,
              customerNumber: `LOCAL-${1000 + customers.length + 1}`,
              risk: form.type === "BRF" ? 36 : 22,
              health: form.type === "BRF" ? 68 : 79,
              status: "Lokalt utkast",
              createdAt: new Date().toLocaleDateString("sv-SE"),
              updatedAt: new Date().toLocaleDateString("sv-SE"),
              propertyCount: 1,
              reportCount: 0,
              latestReportId: "",
              latestReportDate: "",
              properties: [],
            };

      setCustomers((current) => [next, ...current]);
      setSelectedId(next.id);
      setForm(emptyCustomer);
      setAllowDuplicate(false);
      window.localStorage.removeItem("rvm_customer_draft_v2");
      setMessage(result.message);
    });
  }

  function importProfile() {
    const parsed = parseProfileText(profileText);
    setForm((current) => {
      const next = mergeParsedCustomer(current, parsed);
      const parsedName = String(parsed.name ?? "").trim().split(/\s+/);
      if (current.customerKind === "PRIVATE" && parsedName.length > 1) {
        next.firstName ||= parsedName.slice(0, -1).join(" ");
        next.lastName ||= parsedName.slice(-1).join("");
      } else if (current.customerKind === "COMPANY") {
        next.companyName ||= String(parsed.name ?? "");
      }
      if (parsed.address) next.streetAddress ||= String(parsed.address).split(",")[0]?.trim() ?? "";
      next.propertyName ||= String(parsed.property ?? "");
      return next;
    });
    const importedKeys = Object.entries(parsed).filter(([, value]) => String(value ?? "").trim()).length;
    setMessage(importedKeys > 0
      ? `Underlaget tolkades och ${importedKeys} fält fylldes i. Kontrollera innan du sparar.`
      : "Ingen tydlig kunddata hittades. Klistra in hela profilen eller fyll manuellt.");
  }

  function publishToPortal() {
    if (!selected) return;
    startTransition(async () => {
      const result = await publishCustomerToPortalAction(selected.id);
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === selected.id
            ? {
                ...customer,
                ...(result.ok ? result.customer : {}),
                propertyCount: customer.propertyCount,
                reportCount: customer.reportCount,
                latestReportId: customer.latestReportId,
                latestReportDate: customer.latestReportDate,
                properties: customer.properties,
                status: "Publicerad portal",
              }
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

  function updateForm(patch: Partial<CustomerFormState>) {
    setAllowDuplicate(false);
    setForm((current) => ({ ...current, ...patch }));
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
            <span>Kund + första fastighet</span>
          </div>
          <div className="customerKindSwitch" aria-label="Kundtyp">
            <button className={form.customerKind === "PRIVATE" ? "active" : ""} onClick={() => updateForm({ customerKind: "PRIVATE" })} type="button">Privatperson</button>
            <button className={form.customerKind === "COMPANY" ? "active" : ""} onClick={() => updateForm({ customerKind: "COMPANY" })} type="button">Företag</button>
          </div>
          <div className="profileImportBox">
            <button type="button" onClick={() => setShowProfileImport((current) => !current)}>
              {showProfileImport ? "Dölj import" : "Importera kunduppgifter"}
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

          <fieldset className="customerFormGroup">
            <legend>Kontaktuppgifter</legend>
            {form.customerKind === "PRIVATE" ? (
              <div className="formSplit">
                <label>
                  Förnamn *
                  <input value={inputValue(form.firstName)} onChange={(event) => updateForm({ firstName: event.target.value })} />
                  {errors.firstName ? <small>{errors.firstName}</small> : null}
                </label>
                <label>
                  Efternamn *
                  <input value={inputValue(form.lastName)} onChange={(event) => updateForm({ lastName: event.target.value })} />
                  {errors.lastName ? <small>{errors.lastName}</small> : null}
                </label>
              </div>
            ) : (
              <>
                <label>
                  Företagsnamn *
                  <input value={inputValue(form.companyName)} onChange={(event) => updateForm({ companyName: event.target.value })} />
                  {errors.companyName ? <small>{errors.companyName}</small> : null}
                </label>
                <div className="formSplit">
                  <label>
                    Kontaktperson förnamn
                    <input value={inputValue(form.contactFirstName)} onChange={(event) => updateForm({ contactFirstName: event.target.value })} />
                  </label>
                  <label>
                    Kontaktperson efternamn
                    <input value={inputValue(form.contactLastName)} onChange={(event) => updateForm({ contactLastName: event.target.value })} />
                  </label>
                </div>
              </>
            )}
            <label>
              Person-/organisationsnummer
              <input value={inputValue(form.identifier)} onChange={(event) => updateForm({ identifier: event.target.value })} />
              {errors.identifier ? <small>{errors.identifier}</small> : null}
            </label>
            <div className="formSplit">
              <label>
                Telefon *
                <input value={inputValue(form.phone)} onChange={(event) => updateForm({ phone: event.target.value })} />
                {errors.phone ? <small>{errors.phone}</small> : null}
              </label>
              <label>
                E-post
                <input type="email" value={inputValue(form.email)} onChange={(event) => updateForm({ email: event.target.value })} />
                {errors.email ? <small>{errors.email}</small> : null}
              </label>
            </div>
          </fieldset>

          <fieldset className="customerFormGroup">
            <legend>Fastighet</legend>
            <label>
              Fastighetsnamn / benämning
              <input value={inputValue(form.propertyName)} onChange={(event) => updateForm({ propertyName: event.target.value })} placeholder="Villa Söråker" />
            </label>
            <label>
              Gatuadress *
              <input value={inputValue(form.streetAddress)} onChange={(event) => updateForm({ streetAddress: event.target.value })} />
              {errors.streetAddress ? <small>{errors.streetAddress}</small> : null}
            </label>
            <div className="formSplit">
              <label>
                Postnummer
                <input value={inputValue(form.postalCode)} onChange={(event) => updateForm({ postalCode: event.target.value })} />
                {errors.postalCode ? <small>{errors.postalCode}</small> : null}
              </label>
              <label>
                Ort
                <input value={inputValue(form.city)} onChange={(event) => updateForm({ city: event.target.value })} />
              </label>
            </div>
            <label>
              Fastighetsbeteckning
              <input value={inputValue(form.property)} onChange={(event) => updateForm({ property: event.target.value })} />
            </label>
          </fieldset>
          <div className="formSplit">
            <label>
              Fastighetstyp
              <select value={inputValue(form.type) || "Villa"} onChange={(event) => updateForm({ type: event.target.value })}>
                <option>Villa</option>
                <option>Radhus</option>
                <option>BRF</option>
                <option>Kommersiell</option>
              </select>
            </label>
            <label>
              Byggår
              <input inputMode="numeric" value={inputValue(form.buildYear)} onChange={(event) => updateForm({ buildYear: event.target.value.replace(/[^\d]/g, "").slice(0, 4) })} />
              {errors.buildYear ? <small>{errors.buildYear}</small> : null}
            </label>
          </div>
          <div className="formSplit">
            <label>
              Värmekälla
              <select value={inputValue(form.heating) || "Bergvärme"} onChange={(event) => updateForm({ heating: event.target.value })}>
                <option>Bergvärme</option>
                <option>Fjärrvärme</option>
                <option>Luft/vatten</option>
                <option>Frånluftsvärmepump</option>
              </select>
            </label>
            <label>
              Underlagslänk
              <input value={inputValue(form.profileSourceUrl)} onChange={(event) => updateForm({ profileSourceUrl: event.target.value })} placeholder="https://www.ratsit.se/..." />
            </label>
          </div>
          <label>
            Första rekommenderade åtgärd
            <input value={inputValue(form.nextAction)} onChange={(event) => updateForm({ nextAction: event.target.value })} />
          </label>
          {possibleDuplicate ? (
            <div className="duplicateNotice">
              <strong>Möjlig befintlig kund</strong>
              <span>{possibleDuplicate.name} · Kundnr {possibleDuplicate.customerNumber || possibleDuplicate.id} · {possibleDuplicate.address}</span>
              <div>
                <button onClick={() => setSelectedId(possibleDuplicate.id)} type="button">Öppna befintlig kund</button>
                <button onClick={() => setAllowDuplicate(true)} type="button">Skapa ändå</button>
              </div>
            </div>
          ) : null}
          <button className="submitButton" disabled={isPending}>
            {isPending ? "Sparar..." : "Skapa kund och journalutkast"}
          </button>
        </form>

        <article className="portalPanel customerRegistryPanel">
          <div className="panelTitle">
            <h3>Kundregister</h3>
            <span>{filteredCustomers.length} kunder</span>
          </div>
          <div className="customerRegistryTools">
            <input
              aria-label="Sök kund"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sök kund, kundnummer, telefon, e-post eller adress..."
              value={query}
            />
            <select aria-label="Status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              {statusOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
            <select aria-label="Sortera" onChange={(event) => setSortBy(event.target.value as (typeof sortOptions)[number])} value={sortBy}>
              {sortOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div className="customerTableWrap">
            <table className="customerTable">
              <thead>
                <tr>
                  <th>Kundnr</th>
                  <th>Kund</th>
                  <th>Fastighet/adress</th>
                  <th>Telefon</th>
                  <th>Status</th>
                  <th>Ändrad</th>
                  <th>Meny</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr className={customer.id === selected?.id ? "selected" : ""} key={customer.id} onClick={() => setSelectedId(customer.id)}>
                    <td>{customer.customerNumber || customer.id}</td>
                    <td><strong>{customer.name}</strong><small>{customer.email || "Ingen e-post"}</small></td>
                    <td><strong>{customer.property}</strong><small>{customer.address}</small></td>
                    <td>{customer.phone || "Ej angivet"}</td>
                    <td><span className="statusPill">{customer.status}</span></td>
                    <td>{customer.updatedAt}</td>
                    <td>
                      <div className="rowMenuWrap">
                        <button aria-label={`Åtgärder för ${customer.name}`} onClick={(event) => { event.stopPropagation(); setOpenMenuId(openMenuId === customer.id ? "" : customer.id); }} type="button">•••</button>
                        {openMenuId === customer.id ? (
                          <div className="rowMenu" onClick={(event) => event.stopPropagation()}>
                            <button onClick={() => { setSelectedId(customer.id); setOpenMenuId(""); }} type="button">Öppna kund</button>
                            {customer.latestReportId ? <a href={`/husrapport?reportId=${customer.latestReportId}`}>Öppna senaste rapport</a> : null}
                            <a href="/admin/new-report">Ny husrapport</a>
                            {customer.phone ? <a href={`tel:${customer.phone}`}>Ring kunden</a> : null}
                            {customer.email ? <a href={`mailto:${customer.email}`}>Skicka e-post</a> : null}
                            <button onClick={() => setMessage("Arkivering kopplas i nästa databassteg. Använd radering bara för felaktiga/testkunder.")} type="button">Arkivera</button>
                            <button className="danger" disabled={isPending} onClick={() => { setOpenMenuId(""); deleteCustomer(customer); }} type="button">Radera</button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCustomers.map((customer) => (
              <div className={customer.id === selected?.id ? "customerMobileCard selected" : "customerMobileCard"} key={`mobile-${customer.id}`} onClick={() => setSelectedId(customer.id)}>
                <span>Kundnr {customer.customerNumber || customer.id}</span>
                <strong>{customer.name}</strong>
                <small>{customer.property} · {customer.address}</small>
                <small>{customer.phone || "Ingen telefon"} · {customer.status}</small>
              </div>
            ))}
            {!filteredCustomers.length ? <p className="emptyState">Ingen kund matchar sökningen.</p> : null}
          </div>
        </article>
      </section>

      {selected && (
        <section className="customerDetail">
          <article className="portalPanel healthPanel customerQuickPanel">
            <p className="sectionKicker">Kundnr {selected.customerNumber || selected.id}</p>
            <h1>{selected.name}</h1>
            <p>{selected.phone || "Ingen telefon"} · {selected.email || "Ingen e-post"}</p>
            <p>{selected.identifier || "Person-/orgnr saknas"} · {selected.propertyCount} fastigheter · {selected.reportCount} husrapporter</p>
            <div className="customerProperties">
              <h3>Fastigheter</h3>
              {(selected.properties.length ? selected.properties : [{ id: selected.id, label: selected.property, address: selected.address, type: selected.type, reportCount: selected.reportCount, latestReportId: selected.latestReportId, latestReportDate: selected.latestReportDate }]).map((property) => (
                <div key={property.id}>
                  <strong>{property.label}</strong>
                  <span>{property.address} · {property.type}</span>
                  <small>{property.reportCount} rapporter{property.latestReportDate ? ` · senaste ${property.latestReportDate}` : ""}</small>
                </div>
              ))}
            </div>
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
              <h3>Snabbåtgärder</h3>
              <span>{selected.status}</span>
            </div>
            <div className="nextSteps">
              <button disabled={isPending} onClick={publishToPortal} type="button">
                {isPending ? "Publicerar..." : "Publicera till kundportal"}
              </button>
              {selected.latestReportId ? <a className="buttonLink" href={`/husrapport?reportId=${selected.latestReportId}`}>Öppna senaste rapport</a> : null}
              <a className="buttonLink" href="/admin/new-report">Ny husrapport</a>
              <a className="buttonLink" href="/admin/properties">Lägg till fastighet</a>
              <a className="buttonLink" href="/admin/husstatus-form">Starta VVS-genomgång</a>
            </div>
          </article>
        </section>
      )}
    </section>
  );
}
