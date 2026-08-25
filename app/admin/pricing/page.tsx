import { prisma } from "../../../lib/prisma";
import { defaultPricingSettings, formatSekFromOre } from "../../../lib/pricing-engine";
import AdminSidebar from "../admin-sidebar";
import {
  createActionTemplateAction,
  createDemoEstimateAction,
  createDiscountRuleAction,
  createMarkupRuleAction,
  createSupplierAction,
  createSupplierPriceAction,
  savePricingSettingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

const COMPANY_ID = "org_rehn_vvs";

function sekInput(ore: number) {
  return String(Math.round(ore / 100));
}

async function getPricingData() {
  try {
    const [
      total,
      priced,
      categories,
      products,
      suppliers,
      discounts,
      markups,
      settings,
      templates,
      estimates,
      reports,
    ] = await Promise.all([
      prisma.productModel.count(),
      prisma.productModel.count({ where: { supplierPrices: { some: { active: true } } } }),
      prisma.productModel.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } }),
      prisma.productModel.findMany({
        include: { manufacturer: true, supplierPrices: { where: { active: true }, include: { supplier: true } } },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
        take: 30,
      }),
      prisma.supplier.findMany({ where: { companyId: COMPANY_ID }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.supplierDiscountRule.findMany({ where: { companyId: COMPANY_ID }, include: { supplier: true }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.materialMarkupRule.findMany({ where: { companyId: COMPANY_ID }, orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.pricingSettings.findUnique({ where: { companyId: COMPANY_ID } }),
      prisma.actionTemplate.findMany({ where: { companyId: COMPANY_ID }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.actionEstimate.findMany({
        where: { companyId: COMPANY_ID },
        include: { materialRows: true, laborRows: true, otherCostRows: true, report: { include: { property: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.houseReport.findMany({
        where: { companyId: COMPANY_ID },
        include: { property: { include: { customer: true } } },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    return {
      databaseOnline: true,
      total,
      priced,
      categories: categories.map((item) => item.category).filter(Boolean),
      products: products.map((product) => ({
        id: product.id,
        rskNumber: product.rskNumber,
        name: product.productName || `${product.manufacturer.name} ${product.modelName}`,
        manufacturer: product.manufacturer.name,
        modelName: product.modelName,
        category: product.category,
        unit: product.unit,
        supplierPrices: product.supplierPrices.map((price) => ({
          id: price.id,
          supplierId: price.supplierId,
          supplierName: price.supplier.name,
          listPriceOre: price.listPriceOre,
        })),
      })),
      suppliers,
      discounts,
      markups,
      settings,
      templates,
      estimates,
      reports,
    };
  } catch {
    return {
      databaseOnline: false,
      total: 0,
      priced: 0,
      categories: [],
      products: [],
      suppliers: [],
      discounts: [],
      markups: [],
      settings: null,
      templates: [],
      estimates: [],
      reports: [],
    };
  }
}

export default async function PricingPage() {
  const data = await getPricingData();
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
          <article className="portalPanel"><span>Rabattbrev</span><strong>{data.discounts.length}</strong><small>Prioritet: RSK, grupp, tillverkare, leverantör</small></article>
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
