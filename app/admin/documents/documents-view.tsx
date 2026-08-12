"use client";

import { useState, useTransition } from "react";
import {
  setDocumentVisibilityAction,
  uploadDocumentAction,
  type DocumentOption,
  type DocumentVm,
} from "./actions";

export default function DocumentsView({
  databaseOnline,
  documents,
  customers,
  properties,
  projects,
}: {
  databaseOnline: boolean;
  documents: DocumentVm[];
  customers: DocumentOption[];
  properties: DocumentOption[];
  projects: DocumentOption[];
}) {
  const [items, setItems] = useState(documents);
  const [message, setMessage] = useState(
    databaseOnline ? "Dokument läses från databasen." : "Databasen är offline. Visar demodokument.",
  );
  const [isPending, startTransition] = useTransition();

  const customerVisible = items.filter((item) => item.visibility === "CUSTOMER").length;
  const internal = items.filter((item) => item.visibility === "INTERNAL").length;

  function upload(formData: FormData) {
    startTransition(async () => {
      const result = await uploadDocumentAction(formData);
      setMessage(result.message);
      if (result.ok) {
        window.location.reload();
      }
    });
  }

  function setVisibility(documentId: string, visibility: "INTERNAL" | "FIELD_TEAM" | "CUSTOMER") {
    startTransition(async () => {
      const result = await setDocumentVisibilityAction(documentId, visibility);
      if (result.ok) {
        setItems((current) => current.map((item) => (item.id === documentId ? { ...item, visibility } : item)));
      }
      setMessage(result.message);
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Dokument och bilder</p>
          <h1>Samla underlag och styr vad kunden får se.</h1>
          <p>
            Här registreras rapporter, egenkontroller, bilder och avtal. Alla filer får checksumma, version,
            synlighet och historik så Fas 1 har ett tydligt dokumentflöde.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/portal">Kundportal</a>
          <a className="buttonLink" href="/husrapport">Status Husrapport</a>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel">
          <span>Dokument</span>
          <strong>{items.length}</strong>
          <small>Registrerade filer</small>
        </article>
        <article className="portalPanel">
          <span>Kundsynliga</span>
          <strong>{customerVisible}</strong>
          <small>Visas i portalen</small>
        </article>
        <article className="portalPanel">
          <span>Interna</span>
          <strong>{internal}</strong>
          <small>Endast Rehn VVS</small>
        </article>
        <article className="portalPanel">
          <span>Lagring</span>
          <strong>Local</strong>
          <small>storage/documents</small>
        </article>
      </section>

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Ladda upp dokument</h3>
            <span>Koppla till kund, fastighet eller projekt</span>
          </div>
          <form action={upload} className="documentForm">
            <label>
              Titel
              <input disabled={!databaseOnline || isPending} name="title" placeholder="Egenkontroll expansionskärl" />
            </label>
            <label>
              Fil
              <input disabled={!databaseOnline || isPending} name="file" type="file" />
            </label>
            <div className="formSplit">
              <label>
                Kund
                <select disabled={!databaseOnline || isPending} name="customerId">
                  <option value="">Ingen</option>
                  {customers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
              <label>
                Fastighet
                <select disabled={!databaseOnline || isPending} name="propertyId">
                  <option value="">Ingen</option>
                  {properties.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <label>
              Projekt
              <select disabled={!databaseOnline || isPending} name="projectId">
                <option value="">Ingen</option>
                {projects.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label>
              Synlighet
              <select disabled={!databaseOnline || isPending} name="visibility" defaultValue="INTERNAL">
                <option value="INTERNAL">Intern</option>
                <option value="FIELD_TEAM">Montör/arbetslag</option>
                <option value="CUSTOMER">Kundportal</option>
              </select>
            </label>
            <button disabled={!databaseOnline || isPending}>Spara dokument</button>
          </form>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Regler i Fas 1</h3>
            <span>Enkelt men lagligt</span>
          </div>
          <div className="documentRules">
            <div><strong>Checksumma</strong><span>Varje uppladdning får SHA-256 för spårbarhet.</span></div>
            <div><strong>Synlighet</strong><span>Endast `CUSTOMER` visas i kundportalen.</span></div>
            <div><strong>Historik</strong><span>Uppladdning och publicering skrivs till audit-loggen.</span></div>
            <div><strong>Lokal demo</strong><span>Filer sparas lokalt och kan bytas mot S3/Blob senare.</span></div>
          </div>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Dokumentregister</h3>
          <span>{items.length} filer</span>
        </div>
        <div className="documentList">
          {items.map((document) => (
            <article key={document.id}>
              <div>
                <span>{document.mimeType}</span>
                <strong>{document.title}</strong>
                <small>{document.fileName} · v{document.version} · {document.sizeKb} kB</small>
              </div>
              <div>
                <span>Koppling</span>
                <strong>{document.customerName}</strong>
                <small>{document.propertyName} · {document.projectNumber}</small>
              </div>
              <div className="requestMeta">
                <b>{document.visibility}</b>
                <time>{document.createdAt}</time>
              </div>
              <div className="requestActions">
                <a className="buttonLink" href={document.downloadUrl}>Öppna</a>
                <button disabled={isPending || !databaseOnline} onClick={() => setVisibility(document.id, "CUSTOMER")}>
                  Publicera
                </button>
                <button disabled={isPending || !databaseOnline} onClick={() => setVisibility(document.id, "INTERNAL")}>
                  Intern
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
