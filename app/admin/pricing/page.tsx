import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

function priceLabel(min: number | null, max: number | null) {
  if (!min && !max) return "Pris saknas";
  if (min && max && min !== max) return `${min.toLocaleString("sv-SE")}-${max.toLocaleString("sv-SE")} kr`;
  return `${(min ?? max ?? 0).toLocaleString("sv-SE")} kr`;
}

async function getPricingData() {
  try {
    const [total, priced, categories, products] = await Promise.all([
      prisma.productModel.count(),
      prisma.productModel.count({
        where: {
          OR: [
            { replacementPriceMinSek: { not: null } },
            { replacementPriceMaxSek: { not: null } },
          ],
        },
      }),
      prisma.productModel.findMany({
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
      }),
      prisma.productModel.findMany({
        include: { manufacturer: true },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
        take: 12,
      }),
    ]);

    return {
      databaseOnline: true,
      total,
      priced,
      categories: categories.length,
      products: products.map((product) => ({
        id: product.id,
        name: `${product.manufacturer.name} ${product.modelName}`,
        category: product.category,
        price: priceLabel(product.replacementPriceMinSek, product.replacementPriceMaxSek),
        active: product.active ? "Aktiv" : "Inaktiv",
      })),
    };
  } catch {
    return { databaseOnline: false, total: 0, priced: 0, categories: 0, products: [] };
  }
}

export default async function PricingPage() {
  const data = await getPricingData();

  return (
    <main className="adminShell">
      <AdminSidebar active="pricing" label="Prisdatabas" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Pris och produkter</p>
            <h1>Prisdatabas</h1>
            <p>Produktregistret används som prisunderlag i Husrapporten, åtgärdsplanen och framtida offerter.</p>
            {!data.databaseOnline ? <p className="databaseNotice">Databasen svarar inte just nu.</p> : null}
          </div>
          <div className="portalActions">
            <a className="buttonLink primary" href="/admin/products">Öppna produktregister</a>
            <a className="buttonLink" href="/admin/husstatus-form">Fyll i rapport</a>
          </div>
        </header>

        <section className="adminKpis">
          <article className="portalPanel"><span>Produkter</span><strong>{data.total}</strong><small>Totalt i registret</small></article>
          <article className="portalPanel"><span>Prissatta</span><strong>{data.priced}</strong><small>Har min/max-pris</small></article>
          <article className="portalPanel"><span>Kategorier</span><strong>{data.categories}</strong><small>Rullistor i formulär</small></article>
          <article className="portalPanel"><span>Status</span><strong>{data.databaseOnline ? "Live" : "Offline"}</strong><small>Prisdata</small></article>
        </section>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Senaste produktunderlag</h3>
            <span>Används för rullistor, prisestimat och åtgärdspaket</span>
          </div>
          <table>
            <thead>
              <tr><th>Produkt</th><th>Kategori</th><th>Pris</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.products.length ? data.products.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.price}</td>
                  <td>{product.active}</td>
                </tr>
              )) : (
                <tr><td colSpan={4}>Inga produkter hittades.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
