"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { HusstatusImage } from "../../../lib/husstatus-images";

export type CustomerImageGroup = {
  key: string;
  customerId: string;
  customerName: string;
  propertyId: string;
  propertyName: string;
  address: string;
  images: HusstatusImage[];
};

type ImagesViewProps = {
  groups: CustomerImageGroup[];
};

function searchableText(group: CustomerImageGroup) {
  return [
    group.customerName,
    group.propertyName,
    group.address,
    ...group.images.flatMap((image) => [image.sectionTitle, image.fieldLabel, image.fileName]),
  ].join(" ").toLowerCase();
}

function formatDate(value: string) {
  if (!value) return "Datum saknas";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(date);
}

export default function ImagesView({ groups }: ImagesViewProps) {
  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState(groups[0]?.key ?? "");

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return groups;
    return groups.filter((group) => searchableText(group).includes(normalizedQuery));
  }, [groups, query]);

  const activeGroup = filteredGroups.find((group) => group.key === activeKey) ?? filteredGroups[0];

  return (
    <section className="imageLibraryWorkspace">
      <div className="imageLibraryToolbar">
        <label>
          <span>Sök kund, adress eller bild</span>
          <input
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök i bildbiblioteket"
            type="search"
            value={query}
          />
        </label>
        <a className="buttonLink" href="/api/admin/images/download">Ladda ner alla bilder</a>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="emptyState">
          <strong>Ingen kund matchar sökningen.</strong>
          <span>Prova kundnamn, adress, formulärdel eller filnamn.</span>
        </div>
      ) : (
        <div className="imageLibraryLayout">
          <aside className="imageCustomerCards" aria-label="Kundbibliotek">
            {filteredGroups.map((group) => {
              const latest = group.images[0];
              const customerVisible = group.images.filter((image) => image.visibility === "CUSTOMER").length;
              return (
                <button
                  className={group.key === activeGroup?.key ? "imageCustomerCard active" : "imageCustomerCard"}
                  key={group.key}
                  onClick={() => setActiveKey(group.key)}
                  type="button"
                >
                  <span>{group.customerName}</span>
                  <strong>{group.propertyName}</strong>
                  <small>{group.address}</small>
                  <div className="imageCustomerMeta">
                    <b>{group.images.length} bilder</b>
                    <em>{customerVisible} kundsynliga</em>
                  </div>
                  <div className="imageCustomerThumbs" aria-hidden="true">
                    {group.images.slice(0, 3).map((image) => (
                      <Image
                        alt=""
                        height={54}
                        key={image.id}
                        src={image.dataUrl}
                        unoptimized
                        width={72}
                      />
                    ))}
                  </div>
                  <small>Senast: {formatDate(latest?.createdAt ?? "")}</small>
                </button>
              );
            })}
          </aside>

          {activeGroup ? (
            <article className="imageLibraryGroup customerGalleryPanel">
              <header>
                <div>
                  <span>{activeGroup.customerName}</span>
                  <strong>{activeGroup.propertyName}</strong>
                  <small>{activeGroup.address}</small>
                </div>
                <div className="portalActions compact">
                  <a className="buttonLink" href={`/api/admin/images/download?propertyId=${activeGroup.propertyId}`}>Ladda ner mapp</a>
                  <a className="buttonLink" href={`/husrapport?propertyId=${activeGroup.propertyId}`}>Husrapport</a>
                </div>
              </header>

              <div className="customerGalleryStats">
                <span>{activeGroup.images.length} bilder totalt</span>
                <span>{activeGroup.images.filter((image) => image.visibility === "CUSTOMER").length} kundsynliga</span>
                <span>{activeGroup.images.filter((image) => image.visibility === "INTERNAL").length} interna</span>
              </div>

              <div className="imageLibraryGrid">
                {activeGroup.images.map((image) => (
                  <figure key={image.id}>
                    <Image
                      alt={`${image.fieldLabel} - ${image.customerName}`}
                      height={180}
                      src={image.dataUrl}
                      unoptimized
                      width={240}
                    />
                    <figcaption>
                      <span>{image.sectionTitle}</span>
                      <strong>{image.fieldLabel}</strong>
                      <small>{image.visibility === "CUSTOMER" ? "Kundsynlig" : "Intern"} · {image.fileName}</small>
                      <small>{formatDate(image.createdAt)}</small>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
