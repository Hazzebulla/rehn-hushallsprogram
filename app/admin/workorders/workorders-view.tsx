"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addMaterialEntryAction,
  addTimeEntryAction,
  updateWorkOrderStatusAction,
  type WorkOrderVm,
} from "./actions";

const statusLabels: Record<string, string> = {
  ASSIGNED: "Tilldelad",
  IN_PROGRESS: "Pågår",
  DONE: "Klar",
};

export default function WorkOrdersView({
  workOrders,
  databaseOnline,
}: {
  workOrders: WorkOrderVm[];
  databaseOnline: boolean;
}) {
  const [items, setItems] = useState(workOrders);
  const [filter, setFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState(workOrders[0]?.id ?? "");
  const [message, setMessage] = useState(
    databaseOnline ? "Arbetsorder läses från databasen." : "Databasen är offline. Visar demoarbetsorder.",
  );
  const [isPending, startTransition] = useTransition();

  const visibleItems = useMemo(
    () => (filter === "ALL" ? items : items.filter((item) => item.status === filter)),
    [filter, items],
  );

  const counters = {
    assigned: items.filter((item) => item.status === "ASSIGNED").length,
    active: items.filter((item) => item.status === "IN_PROGRESS").length,
    done: items.filter((item) => item.status === "DONE").length,
  };

  const selectedWorkOrder = items.find((item) => item.id === selectedId) ?? items[0];
  const totalHours = items.reduce((total, item) => total + item.minutes, 0) / 60;
  const totalMaterial = items.reduce((total, item) => total + item.materialTotalKr, 0);

  function updateStatus(workOrderId: string, status: "ASSIGNED" | "IN_PROGRESS" | "DONE") {
    startTransition(async () => {
      const result = await updateWorkOrderStatusAction(workOrderId, status);
      if (result.ok) {
        setItems((current) => current.map((item) => (item.id === workOrderId ? { ...item, status } : item)));
      }
      setMessage(result.message);
    });
  }

  function addTime(formData: FormData) {
    startTransition(async () => {
      const result = await addTimeEntryAction(formData);
      if (result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === result.workOrderId
              ? {
                  ...item,
                  minutes: item.minutes + (result.minutes ?? 0),
                  status: item.status === "ASSIGNED" ? "IN_PROGRESS" : item.status,
                }
              : item,
          ),
        );
      }
      setMessage(result.message);
    });
  }

  function addMaterial(formData: FormData) {
    startTransition(async () => {
      const result = await addMaterialEntryAction(formData);
      if (result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === result.workOrderId
              ? { ...item, materialTotalKr: item.materialTotalKr + (result.materialTotalKr ?? 0) }
              : item,
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
          <p className="sectionKicker">Arbetsorder</p>
          <h1>Planera, starta och följ upp jobb från kundärenden.</h1>
          <p>
            När ett kundärende konverteras skapas projekt och arbetsorder här. Vyn är enkel med bara det som
            arbetsledare behöver först: kund, fastighet, prioritet, status och nästa åtgärd.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Sparar..." : message}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/admin/requests">Ärendeinkorg</a>
          <a className="buttonLink" href="/admin/invoicing">Fakturaunderlag</a>
          <a className="buttonLink" href="/admin/customers">Kunder</a>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel">
          <span>Tilldelade</span>
          <strong>{counters.assigned}</strong>
          <small>Väntar på start</small>
        </article>
        <article className="portalPanel">
          <span>Pågående</span>
          <strong>{counters.active}</strong>
          <small>Jobb som är igång</small>
        </article>
        <article className="portalPanel">
          <span>Klara</span>
          <strong>{counters.done}</strong>
          <small>Redo för fakturering</small>
        </article>
        <article className="portalPanel">
          <span>Totalt</span>
          <strong>{items.length}</strong>
          <small>Synliga arbetsorder</small>
        </article>
      </section>

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Registrera tid</h3>
            <span>{totalHours.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} h registrerat</span>
          </div>
          <form action={addTime} className="workEntryForm">
            <label>
              Arbetsorder
              <select
                disabled={!databaseOnline || isPending}
                name="workOrderId"
                onChange={(event) => setSelectedId(event.target.value)}
                value={selectedWorkOrder?.id ?? ""}
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.projectNumber} - {item.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="formSplit">
              <label>
                Minuter
                <input defaultValue="60" disabled={!databaseOnline || isPending} min="1" name="minutes" type="number" />
              </label>
              <label>
                Typ
                <select disabled={!databaseOnline || isPending} name="workType">
                  <option>Service</option>
                  <option>Installation</option>
                  <option>Felsökning</option>
                  <option>Egenkontroll</option>
                </select>
              </label>
            </div>
            <label>
              Notering
              <input disabled={!databaseOnline || isPending} name="description" placeholder="Utfört arbete" />
            </label>
            <button disabled={!databaseOnline || isPending}>Spara tid</button>
          </form>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Registrera material</h3>
            <span>{Math.round(totalMaterial).toLocaleString("sv-SE")} kr registrerat</span>
          </div>
          <form action={addMaterial} className="workEntryForm">
            <input name="workOrderId" type="hidden" value={selectedWorkOrder?.id ?? ""} />
            <label>
              Material
              <input disabled={!databaseOnline || isPending} name="name" placeholder="Expansionskärl Reflex N 18" />
            </label>
            <div className="formSplit">
              <label>
                Antal
                <input defaultValue="1" disabled={!databaseOnline || isPending} min="0.1" name="quantity" step="0.1" type="number" />
              </label>
              <label>
                Enhet
                <select disabled={!databaseOnline || isPending} name="unit">
                  <option>st</option>
                  <option>m</option>
                  <option>tim</option>
                  <option>pkt</option>
                </select>
              </label>
            </div>
            <label>
              Försäljningspris kr
              <input defaultValue="0" disabled={!databaseOnline || isPending} min="0" name="salesKr" type="number" />
            </label>
            <button disabled={!databaseOnline || isPending}>Spara material</button>
          </form>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Jobblista</h3>
          <div className="statusTabs" aria-label="Filtrera arbetsorder">
            {[
              ["ALL", "Alla"],
              ["ASSIGNED", "Tilldelade"],
              ["IN_PROGRESS", "Pågående"],
              ["DONE", "Klara"],
            ].map(([value, label]) => (
              <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {visibleItems.length ? (
          <div className="workOrderList">
            {visibleItems.map((workOrder) => (
              <article key={workOrder.id}>
                <div>
                  <span>{workOrder.projectNumber}</span>
                  <strong>{workOrder.title}</strong>
                  <small>{workOrder.customerName}</small>
                </div>
                <div>
                  <span>Fastighet</span>
                  <strong>{workOrder.propertyName}</strong>
                  <small>{workOrder.address}</small>
                </div>
                <div className="requestMeta">
                  <b>{workOrder.priority}</b>
                  <b>{statusLabels[workOrder.status] ?? workOrder.status}</b>
                  <time>{workOrder.scheduledAt}</time>
                  <small>{Math.round(workOrder.minutes / 60 * 10) / 10} h · {Math.round(workOrder.materialTotalKr).toLocaleString("sv-SE")} kr</small>
                </div>
                <div className="requestActions">
                  <button
                    disabled={isPending || !databaseOnline || workOrder.status === "IN_PROGRESS"}
                    onClick={() => updateStatus(workOrder.id, "IN_PROGRESS")}
                  >
                    Starta
                  </button>
                  <button
                    disabled={isPending || !databaseOnline || workOrder.status === "DONE"}
                    onClick={() => updateStatus(workOrder.id, "DONE")}
                  >
                    Klar
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <strong>Inga arbetsorder i detta filter.</strong>
            <span>Skapa en arbetsorder från ett kundärende eller byt filter.</span>
          </div>
        )}
      </section>
    </section>
  );
}
