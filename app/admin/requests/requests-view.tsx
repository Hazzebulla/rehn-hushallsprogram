"use client";

import { useState, useTransition } from "react";
import { closeRequestAction, createWorkOrderFromRequestAction, type RequestVm } from "./actions";

export default function RequestsView({
  requests,
  databaseOnline,
}: {
  requests: RequestVm[];
  databaseOnline: boolean;
}) {
  const [items, setItems] = useState(requests);
  const [message, setMessage] = useState(
    databaseOnline ? "Ärenden läses från databasen." : "Databasen är offline. Visar demoärenden.",
  );
  const [isPending, startTransition] = useTransition();

  function convert(requestId: string) {
    startTransition(async () => {
      const result = await createWorkOrderFromRequestAction(requestId);
      if (result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === requestId ? { ...item, status: "CONVERTED_TO_WORK_ORDER" } : item,
          ),
        );
      }
      setMessage(result.message);
    });
  }

  function close(requestId: string) {
    startTransition(async () => {
      const result = await closeRequestAction(requestId);
      if (result.ok) {
        setItems((current) => current.map((item) => (item.id === requestId ? { ...item, status: "CLOSED" } : item)));
      }
      setMessage(result.message);
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">Kundärenden</p>
          <h1>Från kundportal till rapportunderlag.</h1>
          <p>
            Här hamnar offertförfrågningar, felanmälningar och bokningsförslag från kundportalen.
            Admin kan göra om kundens text till åtgärdsunderlag utan att skriva om uppgifterna.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
      </header>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Ärendeinkorg</h3>
          <span>{items.length} ärenden</span>
        </div>
        <div className="requestInbox">
          {items.map((request) => (
            <article key={request.id}>
              <div>
                <span>{request.category}</span>
                <strong>{request.customerName}</strong>
                <small>{request.propertyName} · {request.address}</small>
              </div>
              <p>{request.description}</p>
              <div className="requestMeta">
                <b>{request.priority}</b>
                <b>{request.status}</b>
                <time>{request.createdAt}</time>
              </div>
              <div className="requestActions">
                <button disabled={isPending || !databaseOnline} onClick={() => convert(request.id)}>
                  Skapa åtgärdsunderlag
                </button>
                <button disabled={isPending || !databaseOnline} onClick={() => close(request.id)}>
                  Stäng
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
