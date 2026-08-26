import { redirect } from "next/navigation";
import { defaultPricingSettings } from "../../../../lib/pricing-engine";
import { prisma } from "../../../../lib/prisma";
import { technicalSummary } from "../../../../lib/product-registry";
import { getCurrentSessionUser } from "../../../../lib/session";
import AdminSidebar from "../../admin-sidebar";

export const dynamic = "force-dynamic";

const COMPANY_ID = "org_rehn_vvs";

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${Math.round(value).toLocaleString("sv-SE")} kr`;
}

function dateLabel(value: Date | null | undefined) {
  if (!value) return "-";
  return value.toLocaleDateString("sv-SE");
}

function priceNumber(priceRawValue: string | null | undefined, price: unknown) {
  const parsedRaw = Number(String(priceRawValue ?? "").replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(parsedRaw) && parsedRaw > 0) return parsedRaw;
  const parsedPrice = Number(price);
  return Number.isFinite(parsedPrice) ? parsedPrice : null;
}

function sameText(a: string | null | undefined, b: string | null | undefined) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

function priceStatus(validTo: Date | null | undefined) {
  if (!validTo) return "Okänd";
  const daysLeft = Math.ceil((validTo.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return "Utgången";
  if (daysLeft <= 45) return "Löper snart ut";
  return "Aktiv";
}

function discountMatchLabel(rule: { rskNumber: string | null; discountGroupCode: string | null; productGroup: string | null; category: string | null; manufacturerName: string | null; supplierId: string | null } | null | undefined) {
  if (!rule) return "Ingen rabattregel";
  if (rule.rskNumber) return `RSK ${rule.rskNumber}`;
  if (rule.discountGroupCode) return `Rabattgrupp ${rule.discountGroupCode}`;
  if (rule.productGroup) return `Produktgrupp ${rule.productGroup}`;
  if (rule.category) return `Kategori ${rule.category}`;
  if (rule.manufacturerName) return `Tillverkare ${rule.manufacturerName}`;
  if (rule.supplierId) return "Leverantör";
  return "Generell regel";
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const session = await getCurrentSessionUser();
  if (!session || session.role === "CUSTOMER") redirect("/login?next=/admin/products");

  const { productId } = await params;
  const companyId = session.companyId || COMPANY_ID;

  const [product, settings, markupRules, discountRules] = await Promise.all([
    prisma.productModel.findFirst({
      where: { id: productId, active: true },
      include: {
        manufacturer: true,
        supplierProducts: {
          where: { companyId, active: true },
          include: {
            supplier: true,
            prices: {
              include: { priceList: true },
              orderBy: [{ validTo: "desc" }, { importedAt: "desc" }],
              take: 12,
            },
          },
          orderBy: { supplierName: "asc" },
        },
      },
    }),
    prisma.pricingSettings.findUnique({ where: { companyId } }),
    prisma.materialMarkupRule.findMany({ where: { companyId, active: true }, orderBy: { createdAt: "desc" } }),
    prisma.supplierDiscountRule.findMany({ where: { companyId, active: true }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);

  if (!product) redirect("/admin/products");

  const pricingSettings = settings ?? defaultPricingSettings;
  const productMarkup = markupRules.find((rule) => rule.productModelId === product.id);
  const categoryMarkup = markupRules.find((rule) => !rule.productModelId && rule.category && sameText(rule.category, product.category));
  const markupPercent = Number(productMarkup?.markupPercent ?? categoryMarkup?.markupPercent ?? pricingSettings.materialMarkupPercent);
  const primarySupplierProduct = product.supplierProducts.find((item) => item.prices.length) ?? product.supplierProducts[0];
  const primaryPrice = primarySupplierProduct?.prices[0];
  const discountRule = primarySupplierProduct
    ? discountRules.find((rule) =>
        (rule.rskNumber && (sameText(rule.rskNumber, product.rskNumber) || sameText(rule.rskNumber, primarySupplierProduct.rskNumber)))
        || (rule.discountGroupCode && sameText(rule.discountGroupCode, primarySupplierProduct.calculationGroup))
        || (rule.productGroup && sameText(rule.productGroup, primarySupplierProduct.calculationGroup))
        || (rule.category && sameText(rule.category, product.category))
        || (rule.manufacturerName && sameText(rule.manufacturerName, product.manufacturer.name))
        || (rule.supplierId && rule.supplierId === primarySupplierProduct.supplierId)
      )
    : null;
  const listPrice = primaryPrice ? priceNumber(primaryPrice.priceRawValue, primaryPrice.price) : null;
  const discountPercent = Number(discountRule?.discountPercent ?? 0);
  const netPrice = listPrice === null ? null : Math.round(listPrice * (1 - discountPercent / 100) * 100) / 100;
  const customerPrice = netPrice === null ? null : Math.round(netPrice * (1 + markupPercent / 100) * 100) / 100;

  return (
    <main className="adminShell">
      <AdminSidebar active="products" label="Produktdetalj" />
      <section className="adminWork productDetail">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Produktregister</p>
            <h1>{product.productName || product.modelName}</h1>
            <p>{technicalSummary(product) || `${product.manufacturer.name} · ${product.category}`}</p>
          </div>
          <div className="portalActions">
            <a className="buttonLink" href="/admin/pricing">Prisdatabas</a>
            <a className="buttonLink" href="/admin/products">Alla produkter</a>
          </div>
        </header>

        <section className="adminKpis">
          <article className="portalPanel"><span>RSK</span><strong>{product.rskNumber ?? "-"}</strong><small>{product.unit}</small></article>
          <article className="portalPanel"><span>Leverantörer</span><strong>{product.supplierProducts.length}</strong><small>Kopplade artiklar</small></article>
          <article className="portalPanel"><span>Listpris</span><strong>{money(listPrice)}</strong><small>{primaryPrice?.priceList.code ?? "Pris saknas"}</small></article>
          <article className="portalPanel"><span>Kundpris</span><strong>{money(customerPrice)}</strong><small>{discountPercent.toLocaleString("sv-SE")} % rabatt · {markupPercent.toLocaleString("sv-SE")} % påslag</small></article>
        </section>

        <section className="pricingGrid">
          <article className="portalPanel productDetailCard">
            <div className="panelTitle"><h3>Produkt</h3><span>Central produktdata</span></div>
            <dl className="priceResultFacts">
              <div><dt>Namn</dt><dd>{product.productName || product.modelName}</dd></div>
              <div><dt>Tillverkare</dt><dd>{product.manufacturer.name}</dd></div>
              <div><dt>Kategori</dt><dd>{product.category}</dd></div>
              <div><dt>Enhet</dt><dd>{product.unit}</dd></div>
              <div><dt>Systemtyp</dt><dd>{product.systemType ?? "-"}</dd></div>
              <div><dt>Datakvalitet</dt><dd>{product.dataQuality}</dd></div>
              <div><dt>Manual</dt><dd>{product.manualUrl ? <a href={product.manualUrl}>Öppna</a> : "-"}</dd></div>
              <div><dt>Källa</dt><dd>{product.sourceUrl ? <a href={product.sourceUrl}>Öppna</a> : "-"}</dd></div>
            </dl>
          </article>

          <article className="portalPanel productDetailCard">
            <div className="panelTitle"><h3>Prisberäkning</h3><span>Intern kalkyl, visas inte i kundrapport</span></div>
            <dl className="priceResultFacts">
              <div><dt>Listpris</dt><dd>{money(listPrice)}</dd></div>
              <div><dt>Rabatt</dt><dd>{discountPercent.toLocaleString("sv-SE")} %</dd></div>
              <div><dt>Inköpspris</dt><dd>{money(netPrice)}</dd></div>
              <div><dt>Påslag</dt><dd>{markupPercent.toLocaleString("sv-SE")} %</dd></div>
              <div><dt>Kundpris</dt><dd><strong>{money(customerPrice)}</strong></dd></div>
              <div><dt>Prislista</dt><dd>{primaryPrice?.priceList.code ?? "-"}</dd></div>
              <div><dt>Giltighet</dt><dd>{dateLabel(primaryPrice?.validFrom)} - {dateLabel(primaryPrice?.validTo)}</dd></div>
              <div><dt>Rabattregel</dt><dd>{discountMatchLabel(discountRule)}</dd></div>
            </dl>
            {primaryPrice?.validTo && primaryPrice.validTo.getTime() < Date.now() ? (
              <p className="databaseNotice">Varning: senaste priset är utgånget. Importera nyare prislista innan skarp offert.</p>
            ) : null}
          </article>
        </section>

        <section className="portalPanel">
          <div className="panelTitle"><h3>Leverantörer och prisversioner</h3><span>Historiska priser behålls per prislista</span></div>
          <table>
            <thead>
              <tr><th>Leverantör</th><th>Artikelnummer</th><th>Produktgrupp</th><th>Prislista</th><th>Listpris</th><th>Status</th><th>Giltig från</th><th>Giltig till</th></tr>
            </thead>
            <tbody>
              {product.supplierProducts.flatMap((supplierProduct) =>
                supplierProduct.prices.length
                  ? supplierProduct.prices.map((price) => (
                      <tr key={price.id}>
                        <td>{supplierProduct.supplier.name}</td>
                        <td>{supplierProduct.supplierArticleNumber}</td>
                        <td>{supplierProduct.calculationGroup ?? "-"}</td>
                        <td>{price.priceList.code}</td>
                        <td>{money(priceNumber(price.priceRawValue, price.price))}</td>
                        <td><span className={`priceStatus ${priceStatus(price.validTo) === "Aktiv" ? "active" : priceStatus(price.validTo) === "Löper snart ut" ? "soon" : "expired"}`}>{priceStatus(price.validTo)}</span></td>
                        <td>{dateLabel(price.validFrom)}</td>
                        <td>{dateLabel(price.validTo)}</td>
                      </tr>
                    ))
                  : [(
                      <tr key={supplierProduct.id}>
                        <td>{supplierProduct.supplier.name}</td>
                        <td>{supplierProduct.supplierArticleNumber}</td>
                        <td>{supplierProduct.calculationGroup ?? "-"}</td>
                        <td colSpan={5}>Inga prisversioner sparade</td>
                      </tr>
                    )],
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
