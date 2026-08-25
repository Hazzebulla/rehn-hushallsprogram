"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { createPortalRequestAction } from "./actions";

export type PortalVm = {
  customerId: string;
  propertyId?: string;
  customerName: string;
  propertyName: string;
  address: string;
  health: number;
  risk: number;
  nextAction: string;
  databaseOnline: boolean;
  docs: Array<{ title: string; url: string }>;
  images: Array<{ id: string; title: string; section: string; src: string }>;
  properties: Array<{ id: string; customerName: string; label: string; address: string }>;
};

const componentRisks = [
  { name: "Expansionskärl", place: "Teknikrum", now: 84, next: 92, due: "inom 8 mån", action: "Offert skickad" },
  { name: "Vattensäkring kök", place: "Kök", now: 72, next: 81, due: "inom 12 mån", action: "Paket rekommenderat" },
  { name: "Radiatorventiler", place: "Plan 1", now: 58, next: 69, due: "inom 2 år", action: "Planera åtgärd" },
  { name: "Varmvatten", place: "Tvättstuga", now: 42, next: 48, due: "följ upp", action: "Mätning krävs" },
];

const timeline = [
  ["2026", "Byt expansionskärl", "4 500-7 500 kr", "Hög"],
  ["2026", "Vattensäkring kök", "16 000-27 000 kr", "Hög"],
  ["2028", "Radiatorventiler 10 st", "10 000-13 000 kr", "Medel"],
  ["2031", "Filma/spola avlopp", "6 000-12 000 kr", "Medel"],
  ["2040", "Service/byte värmepump", "135 000-190 000 kr", "Hög"],
];

export default function PortalView({ data }: { data: PortalVm }) {
  const reportUrl = data.propertyId ? `/husrapport?propertyId=${data.propertyId}` : "/husrapport";
  const [message, setMessage] = useState(
    data.databaseOnline ? "Portalen läser publicerad data från databasen." : "Databasen är offline. Portalen visar demo-data.",
  );
  const [isPending, startTransition] = useTransition();

  function createRequest(category: string, description: string) {
    startTransition(async () => {
      const result = await createPortalRequestAction({
        customerId: data.customerId,
        propertyId: data.propertyId,
        category,
        description,
      });
      setMessage(result.message);
    });
  }

  return (
    <main className="portalShell">
      <nav className="modeNav inline" aria-label="Demo navigation">
        <a href="/">Omslag</a>
        <a href={reportUrl}>Status Husrapport</a>
        <a className="active" href="/portal">Kundkonto</a>
        <a href="/admin">RVM arbetsyta</a>
      </nav>

      <header className="portalHero">
        <div className="brandLine">
          <div className="miniMark" />
          <div>
            <strong>RVM Husstatus</strong>
            <span>Kundportal · {data.customerName}</span>
          </div>
        </div>
        <div className="portalActions">
          <button disabled={isPending} onClick={() => createRequest("Offertförfrågan", data.nextAction)}>
            Begär offert
          </button>
          <button disabled={isPending} onClick={() => createRequest("Felanmälan", "Kunden rapporterar problem via portalen.")}>
            Rapportera fel
          </button>
          <button disabled={isPending} onClick={() => createRequest("Bokningsförslag", "Kunden vill föreslå tid för service.")}>
            Föreslå tid
          </button>
        </div>
      </header>

      <div className={`persistenceNote ${data.databaseOnline ? "online" : "offline"}`}>
        {isPending ? "Skickar..." : message}
      </div>

      {data.properties.length > 1 ? (
        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Välj hus</h3>
            <span>{data.properties.length} publicerade fastigheter</span>
          </div>
          <div className="portalActions">
            {data.properties.map((property) => (
              <a
                className={property.id === data.propertyId ? "buttonLink active" : "buttonLink"}
                href={`/portal?propertyId=${property.id}`}
                key={property.id}
              >
                {property.customerName} · {property.label}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="customerGrid">
        <article className="portalPanel healthPanel">
          <p className="sectionKicker">Fastighetsstatus live</p>
          <h1>{data.propertyName}</h1>
          <p>
            {data.address}. Kunden ser samma tekniska underlag som projektledaren valt att publicera:
            status, risker, åtgärder, dokument och servicehistorik.
          </p>
          <div className="liveScore">
            <div className="scoreOrb">
              <strong>{data.health}</strong>
              <span>/100</span>
            </div>
            <div>
              <b>Risk ökar över tid utan åtgärd</b>
              <span className="liveLine"><i /></span>
              <small>Simulerad live-prognos: {data.risk}% risk idag till {data.risk + 8}% om 12 månader.</small>
            </div>
          </div>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Aktuellt</h3>
            <span>Kopplat till husrapport</span>
          </div>
          <div className="statusCards">
            <div><span>Rekommenderad åtgärd</span><strong>{data.nextAction}</strong><small>Från husjournal</small></div>
            <div><span>Nästa service</span><strong>24 aug</strong><small>08:00-10:00</small></div>
            <div><span>Avtal</span><strong>Utkast</strong><small>Årlig service</small></div>
          </div>
        </article>
      </section>

      <section className="portalTwo">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Risker och komponenter</h3>
            <span>Ökar automatiskt med tid, skick och servicehistorik</span>
          </div>
          <div className="riskList">
            {componentRisks.map((item) => (
              <div className="riskItem" key={item.name}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.place} · {item.due}</span>
                </div>
                <div className="riskTrack">
                  <i style={{ width: `${item.now}%` }} />
                  <em style={{ left: `${item.next}%` }} />
                </div>
                <b>{item.now}%</b>
                <small>{item.action}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Dokument</h3>
            <span>Publicerat från admin</span>
          </div>
          <div className="docList">
            {data.docs.map((doc) => <a href={doc.url} key={doc.title}>{doc.title}</a>)}
          </div>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Bildbibliotek</h3>
          <span>{data.images.length} kundsynliga bilder</span>
        </div>
        {data.images.length > 0 ? (
          <div className="portalImageLibrary">
            {data.images.map((image) => (
              <figure key={image.id}>
                <Image alt={image.title} height={180} src={image.src} unoptimized width={240} />
                <figcaption>
                  <span>{image.section}</span>
                  <strong>{image.title}</strong>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <strong>Inga bilder publicerade än.</strong>
            <span>Bilder från platsbesök visas här när Rehn VVS markerat dem som kundsynliga.</span>
          </div>
        )}
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>20-årsplan i kundkontot</h3>
          <span>Kunden kan förstå framtida kostnader och beställa åtgärd</span>
        </div>
        <div className="customerNotice">
          <strong>Viktigt</strong>
          <span>
            20-årsplanen är en teknisk underhållsplan och inte ett bindande avtal.
            Offert och serviceavtal godkänns separat innan något arbete beställs.
          </span>
        </div>
        <div className="customerTimeline">
          {timeline.map(([year, title, cost, prio]) => (
            <div key={`${year}-${title}`}>
              <time>{year}</time>
              <strong>{title}</strong>
              <span>{cost}</span>
              <b>{prio}</b>
              <button disabled={isPending} onClick={() => createRequest("Offertförfrågan", title)}>Begär offert</button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}


