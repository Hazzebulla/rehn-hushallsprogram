"use client";

import { useEffect, useMemo, useState } from "react";

type ProductPriceResult = {
  id: string;
  rskNumber: string | null;
  productName: string | null;
  modelName: string;
  manufacturer: string;
  category: string;
  unit: string;
  supplierProducts: {
    supplier: string;
    supplierArticleNumber: string;
    calculationGroup: string | null;
    unit: string | null;
    latestPrice: {
      listPrice: number | null;
      priceListCode: string;
      validFrom: string | null;
      validTo: string | null;
      priceStatus: string;
      priceExpired: boolean;
      discountPercent: number;
      netPrice: number | null;
      markupPercent: number;
      customerPrice: number | null;
    } | null;
  }[];
};

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("sv-SE")} kr`;
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("sv-SE");
}

export default function ProductPriceSearch() {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductPriceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sök RSK, Dahl artikelnummer eller produktnamn.");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setProducts([]);
      setLoading(false);
      setMessage("Sök RSK, Dahl artikelnummer eller produktnamn.");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/products?q=${encodeURIComponent(trimmed)}&take=8`, { signal: controller.signal })
        .then((response) => {
          if (response.status === 401) throw new Error("Du behöver vara inloggad för att se intern prisdata.");
          if (!response.ok) throw new Error("Sökningen kunde inte köras.");
          return response.json();
        })
        .then((data) => {
          const nextProducts = Array.isArray(data.products) ? data.products : [];
          setProducts(nextProducts);
          setMessage(nextProducts.length ? `${nextProducts.length} träffar` : "Inga produkter hittades.");
        })
        .catch((error) => {
          if ((error as Error).name === "AbortError") return;
          setProducts([]);
          setMessage((error as Error).message);
        })
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectedProduct = products[0];
  const selectedSupplierProduct = useMemo(
    () => selectedProduct?.supplierProducts.find((item) => item.latestPrice) ?? selectedProduct?.supplierProducts[0],
    [selectedProduct],
  );
  const price = selectedSupplierProduct?.latestPrice;

  return (
    <section className="portalPanel priceSearchPanel">
      <div className="panelTitle">
        <h3>Produktsökning och pris</h3>
        <span>Intern sökning på RSK, Dahl artikelnummer, produktnamn och tillverkare</span>
      </div>
      <label className="priceSearchBox">
        Sök RSK, artikelnummer eller produkt
        <input
          autoComplete="off"
          inputMode="search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ex. 2350007, 6203778, FM Mattsson, PVC markrör"
          type="search"
          value={query}
        />
      </label>
      <div className="priceSearchStatus">{loading ? "Söker..." : message}</div>

      {selectedProduct ? (
        <article className="priceResultCard">
          <div>
            <span className="priceBadge">{selectedSupplierProduct?.supplier ?? "Produkt"}</span>
            <h4>{selectedProduct.productName || selectedProduct.modelName}</h4>
            <p>
              {selectedProduct.rskNumber ? `RSK ${selectedProduct.rskNumber}` : "RSK saknas"}
              {" · "}
              {selectedSupplierProduct?.supplierArticleNumber ? `Dahl art.nr ${selectedSupplierProduct.supplierArticleNumber}` : "Artikelnummer saknas"}
            </p>
          </div>
          <dl className="priceResultFacts">
            <div><dt>Tillverkare</dt><dd>{selectedProduct.manufacturer}</dd></div>
            <div><dt>Kategori</dt><dd>{selectedProduct.category}</dd></div>
            <div><dt>Enhet</dt><dd>{selectedSupplierProduct?.unit || selectedProduct.unit}</dd></div>
            <div><dt>Produktgrupp</dt><dd>{selectedSupplierProduct?.calculationGroup ?? "-"}</dd></div>
            <div><dt>Listpris</dt><dd>{money(price?.listPrice)}</dd></div>
            <div><dt>Rabatt</dt><dd>{price ? `${price.discountPercent.toLocaleString("sv-SE")} %` : "-"}</dd></div>
            <div><dt>Inköpspris</dt><dd>{money(price?.netPrice)}</dd></div>
            <div><dt>Påslag</dt><dd>{price ? `${price.markupPercent.toLocaleString("sv-SE")} %` : "-"}</dd></div>
            <div><dt>Kundpris</dt><dd><strong>{money(price?.customerPrice)}</strong></dd></div>
            <div><dt>Prislista</dt><dd>{price?.priceListCode ?? "-"}</dd></div>
            <div><dt>Giltighet</dt><dd>{dateOnly(price?.validFrom)} - {dateOnly(price?.validTo)}</dd></div>
            <div><dt>Status</dt><dd className={price?.priceExpired ? "priceExpired" : ""}>{price?.priceStatus ?? "Pris saknas"}</dd></div>
          </dl>
          {price?.priceExpired ? (
            <p className="databaseNotice">Varning: priset kommer från en utgången Dahl-prislista. Nyare prislista rekommenderas.</p>
          ) : null}
          <div className="portalActions">
            <a className="buttonLink" href={`/admin/products/${selectedProduct.id}`}>Öppna produktdetalj</a>
            <a className="buttonLink" href="/admin/husstatus-form">Använd i Husrapport</a>
          </div>
        </article>
      ) : null}

      {products.length > 1 ? (
        <div className="priceSearchResults">
          {products.slice(1).map((product) => (
            <button key={product.id} onClick={() => setProducts([product, ...products.filter((item) => item.id !== product.id)])} type="button">
              <strong>{product.productName || product.modelName}</strong>
              <span>{product.rskNumber ? `RSK ${product.rskNumber}` : "RSK saknas"} · {product.category}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
