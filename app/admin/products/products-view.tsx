"use client";

import { useMemo, useState, useTransition } from "react";
import { importProductCsvAction, startJsEducationImportAction, upsertProductModelAction } from "./actions";
import { productCategories, productQualityLabels } from "../../../lib/product-registry";
import type { ProductDataQuality } from "@prisma/client";

export type ProductModelVm = {
  id: string;
  rskNumber: string;
  productName: string;
  manufacturer: string;
  category: string;
  modelName: string;
  systemType: string;
  technicalData: string;
  lifetime: string;
  replacementPrice: string;
  sourceUrl: string;
  manualUrl: string;
  wiringDiagramUrl: string;
  dataQuality: ProductDataQuality;
  lastVerifiedAt: string;
  active: boolean;
};

export type ProductImportLogVm = {
  id: string;
  source: string;
  status: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  startedAt: string;
  completedAt: string;
};

export default function ProductsView({
  databaseOnline,
  products,
  logs,
}: {
  databaseOnline: boolean;
  products: ProductModelVm[];
  logs: ProductImportLogVm[];
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState(
    databaseOnline ? "Produktregistret läses från databasen." : "Databasen är offline.",
  );
  const [isPending, startTransition] = useTransition();

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      `${product.category} ${product.manufacturer} ${product.modelName} ${product.productName} ${product.rskNumber} ${product.systemType}`.toLowerCase().includes(normalized),
    );
  }, [products, query]);

  function saveProduct(formData: FormData) {
    startTransition(async () => {
      const result = await upsertProductModelAction(formData);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  function importCsv(formData: FormData) {
    startTransition(async () => {
      const result = await importProductCsvAction(formData);
      setMessage(result.message);
      if (result.ok) window.location.reload();
    });
  }

  function startJsImport() {
    startTransition(async () => {
      const result = await startJsEducationImportAction();
      setMessage(result.message);
      window.location.reload();
    });
  }

  return (
    <section className="adminWork">
      <header className="adminTop">
        <div>
          <p className="sectionKicker">RVM Produktregister</p>
          <h1>Sökbara komponenter för snabbare husrapport på plats.</h1>
          <p>
            Montören väljer komponenttyp, tillverkare och modell i formuläret. Kända produktuppgifter föreslås
            men serienummer, år, status, mätvärden och bilder fylls alltid i manuellt.
          </p>
          <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
            {isPending ? "Bearbetar..." : message}
          </div>
        </div>
        <div className="portalActions">
          <a className="buttonLink" href="/admin/husstatus-form">Fyll i formulär</a>
          <a className="buttonLink" href="/admin/installations">Installationer</a>
          <a className="buttonLink" href="/husrapport">Husrapport</a>
        </div>
      </header>

      <section className="adminKpis">
        <article className="portalPanel">
          <span>Produkter</span>
          <strong>{products.length}</strong>
          <small>Aktiva och historiska modeller</small>
        </article>
        <article className="portalPanel">
          <span>Tillverkare</span>
          <strong>{new Set(products.map((product) => product.manufacturer)).size}</strong>
          <small>Normaliserade namn</small>
        </article>
        <article className="portalPanel">
          <span>Verifierade</span>
          <strong>{products.filter((product) => product.dataQuality === "verified_manual").length}</strong>
          <small>Manual eller tillverkarkälla</small>
        </article>
        <article className="portalPanel">
          <span>Import</span>
          <strong>{logs[0]?.status ?? "Ej körd"}</strong>
          <small>{logs[0]?.source ?? "Startregister"}</small>
        </article>
      </section>

      <section className="adminGrid lower">
        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Ny eller ändrad produkt</h3>
            <span>Central data för rullistorna</span>
          </div>
          <form action={saveProduct} className="documentForm">
            <div className="formSplit">
              <label>Tillverkare<input name="manufacturer" placeholder="NIBE" required /></label>
              <label>Webbplats<input name="website" placeholder="https://..." /></label>
            </div>
            <div className="formSplit">
              <label>
                Komponenttyp
                <select name="category" required>
                  {productCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>Modell<input name="modelName" placeholder="F1245" required /></label>
            </div>
            <label>Systemtyp<input name="systemType" placeholder="Bergvärmepump med integrerad VVB" /></label>
            <div className="formSplit">
              <label>Effekt min kW<input name="outputMinKw" type="number" step="0.1" /></label>
              <label>Effekt max kW<input name="outputMaxKw" type="number" step="0.1" /></label>
            </div>
            <div className="formSplit">
              <label>Volym liter<input name="tankVolumeLitres" type="number" /></label>
              <label>Dimension<input name="connectionSize" placeholder="DN25 / 180 mm" /></label>
            </div>
            <div className="formSplit">
              <label>Livslängd min år<input name="expectedLifetimeMinYears" type="number" /></label>
              <label>Livslängd max år<input name="expectedLifetimeMaxYears" type="number" /></label>
            </div>
            <div className="formSplit">
              <label>Bytespris min kr<input name="replacementPriceMinSek" type="number" /></label>
              <label>Bytespris max kr<input name="replacementPriceMaxSek" type="number" /></label>
            </div>
            <label>Styrning<input name="controlSystem" placeholder="Varvtalsstyrd" /></label>
            <label>Källa<input name="sourceUrl" placeholder="https://jseducation.se/product/..." /></label>
            <div className="formSplit">
              <label>Manual-länk<input name="manualUrl" /></label>
              <label>Elschema-länk<input name="wiringDiagramUrl" /></label>
            </div>
            <label>
              Datakvalitet
              <select name="dataQuality" defaultValue="estimated">
                {Object.entries(productQualityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <button disabled={!databaseOnline || isPending}>Spara produkt</button>
          </form>
        </article>

        <article className="portalPanel">
          <div className="panelTitle">
            <h3>Import</h3>
            <span>CSV först, extern import senare</span>
          </div>
          <div className="documentRules">
            <div><strong>JS Education</strong><span>Hämtar produktindex och sparar endast referenslänkar, inte PDF-filer.</span></div>
            <div><strong>Manualer</strong><span>PDF-länkar hämtas i batchar. Kör importen igen för att fylla fler dokumentlänkar.</span></div>
            <div><strong>Rullistor</strong><span>Formuläret läser från vår databas, inte från externa sidor.</span></div>
          </div>
          <button className="buttonLink" disabled={!databaseOnline || isPending} onClick={startJsImport} type="button">
            Importera/uppdatera från JS Education
          </button>
          <form action={importCsv} className="documentForm compactForm">
            <label>
              CSV
              <textarea
                name="csv"
                placeholder="manufacturer;category;modelName;systemType;sourceUrl;dataQuality"
                rows={7}
              />
            </label>
            <button disabled={!databaseOnline || isPending}>Importera CSV</button>
          </form>
        </article>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Produkter</h3>
          <span>{filteredProducts.length} träffar</span>
        </div>
        <input
          className="wideSearch"
          placeholder="Sök på komponenttyp, tillverkare eller modell"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="productRegistryList">
          {filteredProducts.map((product) => (
            <article className={!product.active ? "inactive" : ""} key={product.id}>
              <div>
                <span>{product.category}</span>
                <strong>{product.productName || `${product.manufacturer} ${product.modelName}`}</strong>
                <small>{product.rskNumber ? `RSK ${product.rskNumber}` : product.systemType || "Systemtyp saknas"}</small>
              </div>
              <div>
                <span>Tekniska data</span>
                <strong>{product.technicalData || "Ej angivet"}</strong>
                <small>{product.lifetime}</small>
              </div>
              <div>
                <span>Datakvalitet</span>
                <strong>{productQualityLabels[product.dataQuality]}</strong>
                <small>{product.lastVerifiedAt}</small>
              </div>
              <div>
                <span>Pris</span>
                <strong>{product.replacementPrice || "Ej angivet"}</strong>
                <a href={`/admin/products/${product.id}`}>Detalj</a>
                {product.sourceUrl ? <a href={product.sourceUrl} target="_blank" rel="noreferrer">Källa</a> : <small>Källa saknas</small>}
                {product.manualUrl ? <a href={product.manualUrl} target="_blank" rel="noreferrer">Manual</a> : null}
                {product.wiringDiagramUrl ? <a href={product.wiringDiagramUrl} target="_blank" rel="noreferrer">Elschema</a> : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="portalPanel">
        <div className="panelTitle">
          <h3>Importloggar</h3>
          <span>Senaste körningar</span>
        </div>
        <table>
          <thead><tr><th>Källa</th><th>Status</th><th>Nya</th><th>Uppdaterade</th><th>Överhoppade</th><th>Fel</th><th>Start</th><th>Klar</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.source}</td>
                <td>{log.status}</td>
                <td>{log.createdCount}</td>
                <td>{log.updatedCount}</td>
                <td>{log.skippedCount}</td>
                <td>{log.errorCount}</td>
                <td>{log.startedAt}</td>
                <td>{log.completedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );
}

