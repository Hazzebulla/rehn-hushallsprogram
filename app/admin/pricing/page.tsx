import { prisma } from "../../../lib/prisma";
import { defaultPricingSettings, formatSekFromOre } from "../../../lib/pricing-engine";
import { formatDateOnly } from "../../../lib/supplier-discount-letter-parser";
import AdminSidebar from "../admin-sidebar";
import {
  createActionTemplateAction,
  createDemoEstimateAction,
  createDiscountRuleAction,
  createMarkupRuleAction,
  createSupplierAction,
  createSupplierPriceAction,
  confirmDahlPriceListImportAction,
  confirmStructuredDiscountImportAction,
  importDiscountLetterAction,
  previewDahlPriceListAction,
  previewStructuredDiscountLetterAction,
  savePricingSettingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

const COMPANY_ID = "org_rehn_vvs";

function sekInput(ore: number) {
  return String(Math.round(ore / 100));
}

function dateLabel(value: Date | null | undefined) {
  return formatDateOnly(value);
}

function jsonString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : null;
}

function jsonNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "number" ? item : 0;
}

async function getPricingData(discountBatchId?: string, dahlBatchId?: string) {
  try {
    const [
      total,
      priced,
      discountCount,
      categories,
      products,
      suppliers,
      settings,
      templates,
      estimates,
      reports,
      importLogs,
      previewBatch,
      dahlSupplier,
      dahlPriceLists,
      dahlPreviewBatch,
    ] = await Promise.all([
      prisma.productModel.count(),
      prisma.productModel.count({ where: { supplierPrices: { some: { active: true } } } }),
      prisma.supplierDiscountRule.count({ where: { companyId: COMPANY_ID, active: true } }),
      prisma.productModel.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
      prisma.productModel.findMany({
        select: {
          id: true,
          rskNumber: true,
          productName: true,
          modelName: true,
          category: true,
          unit: true,
          manufacturer: { select: { name: true } },
        },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
        take: 18,
      }),
      prisma.supplier.findMany({
        where: { companyId: COMPANY_ID },
        select: { id: true, name: true, active: true },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
      prisma.pricingSettings.findUnique({ where: { companyId: COMPANY_ID } }),
      prisma.actionTemplate.findMany({
        where: { companyId: COMPANY_ID },
        select: {
          id: true,
          name: true,
          category: true,
          defaultWorkMinutes: true,
          rotEligible: true,
          requiresQuote: true,
        },
        orderBy: [{ active: "desc" }, { name: "asc" }],
      }),
      prisma.actionEstimate.findMany({
        where: { companyId: COMPANY_ID },
        select: {
          id: true,
          title: true,
          status: true,
          rotDeductionOre: true,
          customerTotalOre: true,
          publishedPriceOre: true,
          manualPriceOre: true,
          materialRows: { select: { totalCustomerPriceOre: true } },
          laborRows: { select: { totalOre: true } },
          report: { select: { reportNo: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.houseReport.findMany({
        where: { companyId: COMPANY_ID },
        select: {
          id: true,
          reportNo: true,
          property: { select: { address: true, customer: { select: { name: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.productImportLog.findMany({
        where: { source: { startsWith: "Rabattbrev:" } },
        orderBy: { startedAt: "desc" },
        take: 5,
      }),
      discountBatchId
        ? prisma.supplierDiscountImportBatch.findFirst({
            where: { id: discountBatchId, companyId: COMPANY_ID },
            include: {
              supplier: { select: { name: true } },
              rows: {
                orderBy: { rowNumber: "asc" },
                take: 80,
              },
            },
          })
        : Promise.resolve(null),
      prisma.supplier.findFirst({
        where: { companyId: COMPANY_ID, name: "Dahl" },
        select: { id: true, name: true },
      }),
      prisma.supplierPriceList.findMany({
        where: { companyId: COMPANY_ID, supplier: { name: "Dahl" } },
        select: {
          id: true,
          code: true,
          name: true,
          validFrom: true,
          validTo: true,
          importedAt: true,
          sourceFileName: true,
          _count: { select: { prices: true } },
        },
        orderBy: [{ validFrom: "desc" }, { code: "asc" }],
        take: 12,
      }),
      dahlBatchId
        ? prisma.supplierPriceImportBatch.findFirst({
            where: { id: dahlBatchId, companyId: COMPANY_ID },
            include: {
              supplier: { select: { name: true } },
              rows: { orderBy: { rowNumber: "asc" }, take: 100 },
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      databaseOnline: true,
      total,
      priced,
      discountCount,
      categories: categories.map((item) => item.category).filter(Boolean),
      products: products.map((product) => ({
        id: product.id,
        rskNumber: product.rskNumber,
        name: product.productName || `${product.manufacturer.name} ${product.modelName}`,
        manufacturer: product.manufacturer.name,
        modelName: product.modelName,
        category: product.category,
        unit: product.unit,
      })),
      suppliers,
      settings,
      templates,
      estimates,
      reports,
      importLogs,
      previewBatch,
      dahlSupplier,
      dahlPriceLists,
      dahlPreviewBatch,
    };
  } catch {
    return {
      databaseOnline: false,
      total: 0,
      priced: 0,
      discountCount: 0,
      categories: [],
      products: [],
      suppliers: [],
      settings: null,
      templates: [],
      estimates: [],
      reports: [],
      importLogs: [],
      previewBatch: null,
      dahlSupplier: null,
      dahlPriceLists: [],
      dahlPreviewBatch: null,
    };
  }
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ discountBatchId?: string; dahlBatchId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const data = await getPricingData(resolvedSearchParams?.discountBatchId, resolvedSearchParams?.dahlBatchId);
  const settings = data.settings ?? defaultPricingSettings;

  return (
    <main className="adminShell">
      <AdminSidebar active="pricing" label="Prisdatabas" />

      <section className="adminWork pricingAdmin">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Prismotor</p>
            <h1>Prisdatabas, rabattbrev och ROT</h1>
            <p>Intern kalkyl från RSK och åtgärd till material, arbete, moms, ROT och publicerbart kundpris.</p>
            {!data.databaseOnline ? <p className="databaseNotice">Databasen svarar inte just nu.</p> : null}
          </div>
          <div className="portalActions">
            <a className="buttonLink primary" href="/admin/products">Produktregister</a>
            <a className="buttonLink" href="/admin/reports">Husrapporter</a>
          </div>
        </header>

        <section className="adminKpis">
          <article className="portalPanel"><span>Produkter</span><strong>{data.total}</strong><small>Totalt i registret</small></article>
          <article className="portalPanel"><span>Med leverantörspris</span><strong>{data.priced}</strong><small>Kalkylbara material</small></article>
          <article className="portalPanel"><span>Rabattbrev</span><strong>{data.discountCount}</strong><small>Prioritet: RSK, grupp, tillverkare, leverantör</small></article>
          <article className="portalPanel"><span>Åtgärdsmallar</span><strong>{data.templates.length}</strong><small>Standardtider och ROT</small></article>
        </section>

        <section className="pricingGrid">
          <form className="portalPanel pricingForm" action={savePricingSettingsAction}>
            <div className="panelTitle">
              <h3>Inställningar</h3>
              <span>Intern bas exkl. moms, kundpris visas inkl. moms</span>
            </div>
            <div className="pricingFields">
              <label>Timpris exkl. moms<input name="standardHourlyRateSek" type="number" defaultValue={sekInput(settings.standardHourlyRateOre)} /></label>
              <label>Materialpåslag %<input name="materialMarkupPercent" type="number" step="0.1" defaultValue={String(settings.materialMarkupPercent)} /></label>
              <label>Servicebil kr<input name="serviceVehicleFeeSek" type="number" defaultValue={sekInput(settings.serviceVehicleFeeOre)} /></label>
              <label>Minimidebitering min<input name="minimumBillingMinutes" type="number" defaultValue={String(settings.minimumBillingMinutes)} /></label>
              <label>Moms %<input name="vatPercent" type="number" step="0.1" defaultValue={String(settings.vatPercent)} /></label>
              <label>ROT %<input name="rotDeductionPercent" type="number" step="0.1" defaultValue={String(settings.rotDeductionPercent)} /></label>
              <label>Max ROT-avdrag kr<input name="rotMaxDeductionSek" type="number" defaultValue={sekInput(settings.rotMaxDeductionOre)} /></label>
              <label>Avrunda kundpris till kr<input name="customerRoundingIncrementSek" type="number" defaultValue={sekInput(settings.customerRoundingIncrementOre)} /></label>
              <label>Giltighet dagar<input name="estimateValidityDays" type="number" defaultValue={String(settings.estimateValidityDays)} /></label>
              <label>Föredragen leverantör
                <select name="preferredSupplierId" defaultValue={settings.preferredSupplierId ?? ""}>
                  <option value="">Första tillgängliga</option>
                  {data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
              </label>
            </div>
            <label className="pricingCheck"><input name="autoSelectLowestNetPrice" type="checkbox" defaultChecked={settings.autoSelectLowestNetPrice} /> Välj lägsta nettopris automatiskt</label>
            <label className="pricingCheck"><input name="rotEnabledByDefault" type="checkbox" defaultChecked={settings.rotEnabledByDefault} /> ROT på som standard</label>
            <button className="buttonLink primary" type="submit">Spara prisregler</button>
          </form>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Snabb kalkyl</h3>
              <span>Skapar snapshot på vald husrapport</span>
            </div>
            <form className="pricingForm" action={createDemoEstimateAction}>
              <label>Husrapport
                <select name="reportId" required>
                  <option value="">Välj rapport</option>
                  {data.reports.map((report) => <option key={report.id} value={report.id}>{report.reportNo} - {report.property.customer.name}, {report.property.address}</option>)}
                </select>
              </label>
              <label>Åtgärdsmall
                <select name="templateId" required>
                  <option value="">Välj åtgärd</option>
                  {data.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </label>
              <label>Produkt / RSK
                <select name="productModelId">
                  <option value="">Ingen produkt</option>
                  {data.products.map((product) => <option key={product.id} value={product.id}>{product.rskNumber ? `${product.rskNumber} - ` : ""}{product.name}</option>)}
                </select>
              </label>
              <div className="pricingFields two">
                <label>Antal<input name="quantity" type="number" step="0.01" defaultValue="1" /></label>
                <label>Arbetstid min<input name="workMinutes" type="number" placeholder="Från mall" /></label>
              </div>
              <label>ROT
                <select name="rotSelected" defaultValue="unknown">
                  <option value="unknown">Ej bekräftad</option>
                  <option value="yes">Ja</option>
                  <option value="no">Nej</option>
                </select>
              </label>
              <button className="buttonLink primary" type="submit">Skapa kalkyl</button>
            </form>
          </article>
        </section>

        <section className="pricingGrid">
          <form className="portalPanel pricingForm" action={createSupplierAction}>
            <div className="panelTitle"><h3>Leverantörer</h3><span>Dahl, Ahlsell, Onninen, Solar eller annan</span></div>
            <label>Namn<input name="name" placeholder="Dahl" required /></label>
            <button className="buttonLink" type="submit">Lägg till leverantör</button>
            <div className="pricingList">{data.suppliers.map((supplier) => <span key={supplier.id}>{supplier.name}</span>)}</div>
          </form>

          <form className="portalPanel pricingForm" action={createSupplierPriceAction}>
            <div className="panelTitle"><h3>Leverantörspris</h3><span>Listpris sparas per produkt och leverantör</span></div>
            <label>Produkt
              <select name="productModelId" required>
                <option value="">Välj produkt</option>
                {data.products.map((product) => <option key={product.id} value={product.id}>{product.rskNumber ? `${product.rskNumber} - ` : ""}{product.name}</option>)}
              </select>
            </label>
            <label>Leverantör
              <select name="supplierId" required>
                <option value="">Välj leverantör</option>
                {data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <div className="pricingFields two">
              <label>Listpris kr<input name="listPriceSek" type="number" required /></label>
              <label>Enhet<input name="unit" defaultValue="st" /></label>
            </div>
            <label>Leverantörens artikelnummer<input name="supplierSku" /></label>
            <label>Källa/notering<input name="sourceNote" /></label>
            <button className="buttonLink" type="submit">Spara listpris</button>
          </form>
        </section>

        <section className="pricingGrid">
          <form className="portalPanel pricingForm" action={previewDahlPriceListAction}>
            <div className="panelTitle">
              <h3>Dahl prislistor</h3>
              <span>Produkt- och prislistor. Separat från rabattbrev.</span>
            </div>
            <label className="photoDrop wide">Importera Dahl-prislista
              <input
                accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
                name="dahlPriceFile"
                required
                type="file"
              />
            </label>
            <div className="pricingImportHelp wide">
              <strong>Förväntade kolumner</strong>
              <span>Artnr, Benämning, Kalkylgr, Enh, Pris, Nto, Pr.l och Status.</span>
              <span>Artnr sparas som Dahl artikelnummer. Endast verifierbara 7-siffriga nummer kopieras även till RSK.</span>
              <span>Pris sparas som Dahl-prislistedata. Ingen rabatt eller inköpspris räknas fram här.</span>
            </div>
            <button className="buttonLink primary" type="submit">Förhandsgranska Dahl-prislista</button>
          </form>

          <article className="portalPanel pricingForm">
            <div className="panelTitle">
              <h3>Dahl i databasen</h3>
              <span>{data.dahlSupplier ? "Leverantör finns" : "Skapas automatiskt vid import"}</span>
            </div>
            {data.dahlPriceLists.length ? (
              <div className="pricingList vertical">
                {data.dahlPriceLists.map((list) => {
                  const expired = list.validTo ? list.validTo.getTime() < Date.now() : false;
                  return (
                    <span key={list.id}>
                      <strong>{list.code}</strong> {dateLabel(list.validFrom)} - {dateLabel(list.validTo)} · {list._count.prices} produkter · {expired ? "Utgången" : "Aktuell"} · {list.sourceFileName ?? "okänd fil"}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="databaseNotice">Inga Dahl-prislistor importerade ännu.</p>
            )}
          </article>
        </section>

        <section className="pricingGrid">
          <form className="portalPanel pricingForm" action={createDiscountRuleAction}>
            <div className="panelTitle"><h3>Rabattbrev</h3><span>Matchas i ordning: RSK, grupp/kategori, tillverkare, leverantör</span></div>
            <label>Leverantör
              <select name="supplierId">
                <option value="">Alla</option>
                {data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <div className="pricingFields two">
              <label>RSK<input name="rskNumber" /></label>
              <label>Rabatt %<input name="discountPercent" type="number" step="0.1" required /></label>
            </div>
            <div className="pricingFields two">
              <label>Tillverkare<input name="manufacturerName" /></label>
              <label>Kategori<input name="category" /></label>
            </div>
            <label>Produktgrupp<input name="productGroup" /></label>
            <label>Källa/notering<input name="sourceNote" /></label>
            <button className="buttonLink" type="submit">Lägg rabattregel</button>
          </form>

          <form className="portalPanel pricingForm" action={importDiscountLetterAction}>
            <div className="panelTitle">
              <h3>Importera rabattbrev</h3>
              <span>Excel, CSV, TXT eller PDF. Excel/CSV är säkrast.</span>
            </div>
            <label>Standardleverantör
              <select name="supplierId">
                <option value="">Försök läsa från filen</option>
                {data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <label className="photoDrop wide">Ladda upp rabattbrev
              <input accept=".xlsx,.xls,.csv,.txt,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,application/pdf" name="file" type="file" />
            </label>
            <label className="wide">Eller klistra in text / CSV
              <textarea
                name="discountText"
                placeholder={"leverantör;tillverkare;kategori;produktgrupp;rsk;rabatt\nDahl;FM Mattsson;Blandare;;8344302;42"}
                rows={6}
              />
            </label>
            <div className="pricingImportHelp wide">
              <strong>Rekommenderat format</strong>
              <span>En rad per rabattregel. Kolumner: leverantör, tillverkare, kategori, produktgrupp, rsk, rabatt.</span>
              <span>Excel: använd gärna första raden som rubriker. Alla blad läses in.</span>
              <span>Exempel fri text: Dahl FM Mattsson blandare 42 % eller RSK 8344302 rabatt 42 %.</span>
            </div>
            <button className="buttonLink primary" type="submit">Läs in rabattbrev</button>
            {data.importLogs.length ? (
              <div className="pricingImportHelp wide">
                <strong>Senaste importer</strong>
                {data.importLogs.map((log) => (
                  <span key={log.id}>{log.source.replace("Rabattbrev: ", "")}: {log.createdCount} nya, {log.updatedCount} uppdaterade, {log.skippedCount} överhoppade</span>
                ))}
              </div>
            ) : null}
          </form>

          <form className="portalPanel pricingForm" action={previewStructuredDiscountLetterAction}>
            <div className="panelTitle">
              <h3>Strukturerad TXT-import</h3>
              <span>För stora PCL-rabattbrev. Skapar först förhandsgranskning.</span>
            </div>
            <label>Leverantör
              <select name="structuredSupplierId" required>
                <option value="">Välj leverantör</option>
                {data.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
            <div className="pricingFields two">
              <label>Giltig från<input name="structuredValidFrom" type="date" /></label>
              <label>Giltig till<input name="structuredValidTo" type="date" defaultValue="2024-12-31" /></label>
            </div>
            <label className="photoDrop wide">Ladda upp TXT-rabattbrev
              <input accept=".txt,text/plain" name="structuredFile" required type="file" />
            </label>
            <div className="pricingImportHelp wide">
              <strong>Parserformat PCL</strong>
              <span>Exempel: PCL110035300000000000000000TERMOSTATBLANDARE, FMM P0</span>
              <span>Gruppkod: PCL110. Råvärde: 0353. Prisnivå: P0. Råvärdet sparas utan procenttolkning.</span>
            </div>
            <button className="buttonLink primary" type="submit">Förhandsgranska TXT</button>
          </form>

          <form className="portalPanel pricingForm" action={createMarkupRuleAction}>
            <div className="panelTitle"><h3>Påslag</h3><span>Produktregel går före kategori, annars globalt påslag</span></div>
            <label>Produkt
              <select name="productModelId">
                <option value="">Ingen specifik produkt</option>
                {data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label>Kategori
              <select name="category">
                <option value="">Ingen kategori</option>
                {data.categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label>Påslag %<input name="markupPercent" type="number" step="0.1" required /></label>
            <button className="buttonLink" type="submit">Lägg påslag</button>
          </form>
        </section>

        {data.previewBatch ? (
          <section className="portalPanel pricingForm">
            <div className="panelTitle">
              <h3>Förhandsgranskning av rabattbrev</h3>
              <span>{data.previewBatch.sourceFileName} · {data.previewBatch.supplier.name}</span>
            </div>
            <section className="adminKpis">
              <article className="portalPanel"><span>Totalt</span><strong>{data.previewBatch.totalRows}</strong><small>Rader i filen</small></article>
              <article className="portalPanel"><span>Tolkade</span><strong>{data.previewBatch.parsedRows}</strong><small>Redo för import</small></article>
              <article className="portalPanel"><span>Fel</span><strong>{data.previewBatch.errorRows}</strong><small>Importeras inte</small></article>
              <article className="portalPanel"><span>Dubletter</span><strong>{data.previewBatch.duplicateRows}</strong><small>Samma grupp/prisnivå/datum</small></article>
            </section>
            <div className="pricingImportHelp wide">
              <strong>Identifierat format</strong>
              <span>Parsern söker rabattgruppen efter prefix/kundnummer: BA010, CA600, PCL110, PCM110, TF460 och liknande.</span>
              <span>Sista sex siffrorna tolkas som YYMMDD. Prisnivå P0/P1/P2/LA/LB plockas ur beskrivningen om den finns.</span>
              <span>Råvärdet sparas som rawDiscountValue och räknas inte som procent.</span>
            </div>
            <form className="pricingInlineForm" action={confirmStructuredDiscountImportAction}>
              <input name="batchId" type="hidden" value={data.previewBatch.id} />
              <label>Dubletter
                <select name="duplicateMode" defaultValue="skip">
                  <option value="skip">Hoppa över</option>
                  <option value="update">Uppdatera befintlig</option>
                  <option value="new_version">Skapa ny version</option>
                </select>
              </label>
              <button className="buttonLink primary" disabled={data.previewBatch.status !== "preview"} type="submit">Bekräfta import</button>
            </form>
            <table>
              <thead><tr><th>Rad</th><th>Gruppkod</th><th>Beskrivning</th><th>Prisnivå</th><th>Råvärde</th><th>Datum</th><th>Status</th><th>Felorsak</th></tr></thead>
              <tbody>
                {data.previewBatch.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.rowNumber}</td>
                    <td>{row.discountGroupCode ?? "-"}</td>
                    <td>{row.description ?? "-"}</td>
                    <td>{row.priceLevel ?? "-"}</td>
                    <td>{row.rawDiscountValue ?? "-"}</td>
                    <td>{dateLabel(row.validityDate)}</td>
                    <td>{row.parseStatus}</td>
                    <td>{row.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {data.dahlPreviewBatch ? (
          <section className="portalPanel pricingForm">
            <div className="panelTitle">
              <h3>Förhandsgranskning av Dahl-prislista</h3>
              <span>{data.dahlPreviewBatch.sourceFileName} · {data.dahlPreviewBatch.supplier.name}</span>
            </div>
            <section className="adminKpis">
              <article className="portalPanel"><span>Prislista</span><strong>{data.dahlPreviewBatch.priceListCode ?? "Okänd"}</strong><small>{dateLabel(data.dahlPreviewBatch.validFrom)} - {dateLabel(data.dahlPreviewBatch.validTo)}</small></article>
              <article className="portalPanel"><span>Produktrader</span><strong>{data.dahlPreviewBatch.productRows}</strong><small>{data.dahlPreviewBatch.validRows} giltiga</small></article>
              <article className="portalPanel"><span>Fel</span><strong>{data.dahlPreviewBatch.invalidRows}</strong><small>Behöver kontroll</small></article>
              <article className="portalPanel"><span>Dubletter</span><strong>{data.dahlPreviewBatch.duplicateRows}</strong><small>Samma fil eller prislista</small></article>
            </section>
            <section className="adminKpis">
              <article className="portalPanel"><span>Format</span><strong>{jsonString(data.dahlPreviewBatch.formatSummary, "detectedFormat") ?? "Okänt"}</strong><small>Dahl-import</small></article>
              <article className="portalPanel"><span>Prislistkod från</span><strong>{jsonString(data.dahlPreviewBatch.formatSummary, "metadataSource") ?? "okänd"}</strong><small>header eller Pr.l</small></article>
              <article className="portalPanel"><span>Varningar</span><strong>{jsonNumber(data.dahlPreviewBatch.formatSummary, "warningRows")}</strong><small>Importeras men bör kontrolleras</small></article>
              <article className="portalPanel"><span>Status</span><strong>{data.dahlPreviewBatch.status}</strong><small>Preview/import</small></article>
            </section>
            <section className="adminKpis">
              <article className="portalPanel"><span>Nya produkter</span><strong>{data.dahlPreviewBatch.newProducts}</strong><small>Dahl artikelnummer saknas idag</small></article>
              <article className="portalPanel"><span>Befintliga</span><strong>{data.dahlPreviewBatch.existingProducts}</strong><small>Uppdateras med rådata</small></article>
              <article className="portalPanel"><span>Nya priser</span><strong>{data.dahlPreviewBatch.validRows}</strong><small>Efter bekräftelse minus dubletter</small></article>
              <article className="portalPanel"><span>Prisändringar</span><strong>{data.dahlPreviewBatch.priceChanges}</strong><small>Mot samma prislista</small></article>
            </section>
            {data.dahlPreviewBatch.status === "duplicate_file" ? (
              <p className="databaseNotice">Den här filen verkar redan vara importerad och importerades därför inte igen.</p>
            ) : null}
            <div className="pricingImportHelp wide">
              <strong>Viktigt</strong>
              <span>Pris sparas som Dahl-prislistedata, inte som nettopris eller inköpspris.</span>
              <span>Kalkylgr, Nto och Status sparas rått tills Dahl-formatet är verifierat fullt ut.</span>
            </div>
            <form className="pricingInlineForm" action={confirmDahlPriceListImportAction}>
              <input name="dahlBatchId" type="hidden" value={data.dahlPreviewBatch.id} />
              <button className="buttonLink primary" disabled={data.dahlPreviewBatch.status !== "preview" || data.dahlPreviewBatch.validRows === 0} type="submit">Bekräfta Dahl-import</button>
            </form>
            <table>
              <thead>
                <tr><th>Rad</th><th>Artnr</th><th>Benämning</th><th>Kalkylgr</th><th>Enh</th><th>Pris</th><th>Nto</th><th>Pr.l</th><th>Status</th><th>Felorsak</th></tr>
              </thead>
              <tbody>
                {data.dahlPreviewBatch.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.rowNumber}</td>
                    <td>{row.supplierArticleNumber ?? "-"}</td>
                    <td>{row.supplierName ?? "-"}</td>
                    <td>{row.calculationGroup ?? "-"}</td>
                    <td>{row.unit ?? "-"}</td>
                    <td>{row.priceRawValue ?? "-"}</td>
                    <td>{row.ntoRawValue ?? "-"}</td>
                    <td>{row.priceListCode ?? "-"}</td>
                    <td>{row.parseStatus === "duplicate" ? "duplicate" : row.statusRaw ?? row.parseStatus}</td>
                    <td>{row.errorMessage ?? (row.parseStatus === "ready_with_warning" ? "Varning, se rådata" : "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="portalPanel pricingForm">
          <div className="panelTitle"><h3>Åtgärdsmallar</h3><span>Standardtider, förbrukning, övriga avgifter och ROT</span></div>
          <form className="pricingInlineForm" action={createActionTemplateAction}>
            <label>Namn<input name="name" placeholder="Byta köksblandare" required /></label>
            <label>Kategori<input name="category" placeholder="Kök" /></label>
            <label>Standardtid min<input name="defaultWorkMinutes" type="number" defaultValue="90" /></label>
            <label>Förbrukning kr<input name="defaultConsumablesSek" type="number" defaultValue="200" /></label>
            <label>Övrigt kr<input name="defaultOtherCostSek" type="number" defaultValue="0" /></label>
            <label>Produkt
              <select name="recommendedProductModelId">
                <option value="">Ingen standardprodukt</option>
                {data.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label className="pricingCheck"><input name="rotEligible" type="checkbox" defaultChecked /> ROT</label>
            <label className="pricingCheck"><input name="requiresQuote" type="checkbox" /> Kräver separat offert</label>
            <button className="buttonLink" type="submit">Spara mall</button>
          </form>
          <table>
            <thead><tr><th>Mall</th><th>Kategori</th><th>Standardtid</th><th>ROT</th><th>Status</th></tr></thead>
            <tbody>
              {data.templates.length ? data.templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.name}</td>
                  <td>{template.category}</td>
                  <td>{template.defaultWorkMinutes} min</td>
                  <td>{template.rotEligible ? "Ja" : "Nej"}</td>
                  <td>{template.requiresQuote ? "Separat offert" : "Kalkylerbar"}</td>
                </tr>
              )) : <tr><td colSpan={5}>Inga mallar ännu.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="portalPanel">
          <div className="panelTitle"><h3>Senaste kalkyler</h3><span>Snapshot skyddar gamla priser när rabattbrev ändras</span></div>
          <table>
            <thead><tr><th>Rapport</th><th>Åtgärd</th><th>Status</th><th>Material</th><th>Arbete</th><th>ROT</th><th>Kundpris</th></tr></thead>
            <tbody>
              {data.estimates.length ? data.estimates.map((estimate) => (
                <tr key={estimate.id}>
                  <td>{estimate.report.reportNo}</td>
                  <td>{estimate.title}</td>
                  <td>{estimate.status}</td>
                  <td>{formatSekFromOre(estimate.materialRows.reduce((sum, row) => sum + row.totalCustomerPriceOre, 0))}</td>
                  <td>{formatSekFromOre(estimate.laborRows.reduce((sum, row) => sum + row.totalOre, 0))}</td>
                  <td>-{formatSekFromOre(estimate.rotDeductionOre)}</td>
                  <td><strong>{formatSekFromOre(estimate.publishedPriceOre ?? estimate.manualPriceOre ?? estimate.customerTotalOre)}</strong></td>
                </tr>
              )) : <tr><td colSpan={7}>Inga kalkyler skapade ännu.</td></tr>}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
