import { prisma } from "../../../lib/prisma";
import { ensurePublicPreInspectionLink } from "../../../lib/customer-preinspection";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

const companyId = "org_rehn_vvs";

async function getStartData() {
  try {
    const properties = await prisma.property.findMany({
      where: { companyId },
      include: {
        customer: true,
        houseReports: {
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const rows = await Promise.all(properties.map(async (property) => {
      const link = await ensurePublicPreInspectionLink(property.id);
      return {
        id: property.id,
        customer: property.customer.name,
        address: property.address,
        propertyNo: property.propertyNo ?? "Fastighet",
        lastReport: property.houseReports[0]?.reportNo ?? "Ingen rapport",
        customerFormUrl: `/husrapport/start/${link.token}`,
        customerFormStatus: link.status,
      };
    }));

    const blankLink = await ensurePublicPreInspectionLink();

    return {
      databaseOnline: true,
      blankCustomerFormUrl: `/husrapport/start/${blankLink.token}`,
      properties: rows,
    };
  } catch {
    return { databaseOnline: false, blankCustomerFormUrl: "", properties: [] };
  }
}

const steps = [
  ["1", "Grunduppgifter", "Kund, fastighet, adress, byggår och kontaktvägar"],
  ["2", "System och områden", "Värme, tappvatten, våtrum, avlopp, el/styr och övrigt"],
  ["3", "Brister", "Risk, observation, rekommendation och åtgärdsår"],
  ["4", "Produkter", "Komponenter, modell, serienummer, skick och prisdata"],
  ["5", "Bilder", "Foto kopplat till fråga, komponent och kundens bildbibliotek"],
  ["6", "Granskning", "Intern kontroll innan rapporten publiceras"],
];

export default async function NewReportPage() {
  const data = await getStartData();

  return (
    <main className="adminShell">
      <AdminSidebar active="newReport" label="Ny Husrapport" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Starta rapport</p>
            <h1>Ny Husrapport</h1>
            <p>Välj befintlig fastighet eller skapa kund och fastighet först. Rapporten ska alltid vara knuten till en tydlig kund och adress.</p>
            {!data.databaseOnline ? <p className="databaseNotice">Databasen svarar inte just nu.</p> : null}
          </div>
          <div className="portalActions">
            <a className="buttonLink primary" href="/admin/customers">Skapa kund / fastighet</a>
            {data.blankCustomerFormUrl ? <a className="buttonLink" href={data.blankCustomerFormUrl}>Ny kundlänk</a> : null}
            <a className="buttonLink" href="/admin/reports">Visa rapporter</a>
          </div>
        </header>

        <section className="adminGrid lower">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Välj fastighet</h3>
              <span>Startar besiktningsformuläret på rätt kund</span>
            </div>
            <div className="auditList preInspectionList">
              {data.properties.length ? data.properties.map((property) => (
                <div key={property.id}>
                  <time>{property.propertyNo}</time>
                  <strong>{property.customer}</strong>
                  <span>{property.address}</span>
                  <a className="buttonLink" href={property.customerFormUrl}>Kundlänk</a>
                  <a className="buttonLink" href={`/admin/husstatus-form?propertyId=${property.id}`}>Starta</a>
                </div>
              )) : (
                <div>
                  <time>Tomt</time>
                  <strong>Ingen fastighet hittades</strong>
                  <span>Lägg in kund och fastighet först.</span>
                  <a className="buttonLink" href="/admin/customers">Lägg in</a>
                </div>
              )}
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Rapportens struktur</h3>
              <span>Det som ska fyllas och granskas</span>
            </div>
            <div className="queue">
              {steps.map(([step, title, detail]) => (
                <div key={step}>
                  <span>{step}</span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
