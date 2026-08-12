"use client";

import { useMemo, useState, useTransition } from "react";
import { createInvoiceBasisAction, type InvoiceProjectVm } from "./actions";

export default function InvoicingView({
  projects,
  databaseOnline,
}: {
  projects: InvoiceProjectVm[];
  databaseOnline: boolean;
}) {
  const [items, setItems] = useState(projects);
  const [message, setMessage] = useState(
    databaseOnline ? "Fakturaunderlag läses från databasen." : "Databasen är offline. Visar demounderlag.",
  );
  const [isPending, startTransition] = useTransition();

  const totals = useMemo(
    () => ({
      billable: items.filter((item) => !item.invoiceId && item.totalKr > 0).length,
      draft: items.filter((item) => item.invoiceStatus === "DRAFT").length,
      value: items.reduce((total, item) => total + item.totalKr, 0),
      hours: items.reduce((total, item) => total + item.minutes, 0) / 60,
    }),
    [items],
  );

  function createInvoice(projectId: string) {
    startTransition(async () => {
      const result = await createInvoiceBasisAction(projectId);
      if (result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === projectId ? { ...item, invoiceStatus: "DRAFT", invoiceId: "created" } : item,
          ),
        );
      }
      setMessage(result.message);
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Fakturaunderlag</p>
          <h1>Granska tid och material innan faktura.</h1>
          <p>
            Den här vyn är sista kontrollen innan ekonomi. Underlaget skapas från registrerad tid och material,
            samtidigt som posterna markeras godkända och kopplas till fakturautkastet.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/admin/workorders">Arbetsorder</a>
          <a className="buttonLink" href="/admin/requests">Ärenden</a>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel">
          <span>Redo</span>
          <strong>{totals.billable}</strong>
          <small>Kan bli utkast</small>
        </article>
        <article className="portalPanel">
          <span>Utkast</span>
          <strong>{totals.draft}</strong>
          <small>Väntar på faktura</small>
        </article>
        <article className="portalPanel">
          <span>Timmar</span>
          <strong>{totals.hours.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}</strong>
          <small>Registrerat</small>
        </article>
        <article className="portalPanel">
          <span>Värde</span>
          <strong>{Math.round(totals.value).toLocaleString("sv-SE")} kr</strong>
          <small>Tid och material</small>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Projekt att granska</h3>
          <span>Timtaxa demo: 850 kr/h exkl. moms</span>
        </div>
        <div className="invoiceList">
          {items.map((project) => (
            <article key={project.id}>
              <div>
                <span>{project.number}</span>
                <strong>{project.name}</strong>
                <small>{project.customerName} · {project.propertyName}</small>
              </div>
              <div className="invoiceBreakdown">
                <span>Tid</span>
                <strong>{Math.round((project.minutes / 60) * 10) / 10} h</strong>
                <small>{Math.round(project.timeTotalKr).toLocaleString("sv-SE")} kr</small>
              </div>
              <div className="invoiceBreakdown">
                <span>Material</span>
                <strong>{Math.round(project.materialTotalKr).toLocaleString("sv-SE")} kr</strong>
                <small>{project.status}</small>
              </div>
              <div className="invoiceTotal">
                <span>{project.invoiceStatus}</span>
                <strong>{Math.round(project.totalKr).toLocaleString("sv-SE")} kr</strong>
                <button
                  disabled={isPending || !databaseOnline || Boolean(project.invoiceId) || project.totalKr <= 0}
                  onClick={() => createInvoice(project.id)}
                >
                  Skapa utkast
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
