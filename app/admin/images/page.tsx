import { prisma } from "../../../lib/prisma";
import { extractHusstatusImages, type HusstatusImage } from "../../../lib/husstatus-images";
import AdminSidebar from "../admin-sidebar";
import { rvmSections } from "../husstatus-form/spec";
import ImagesView, { type CustomerImageGroup } from "./images-view";

export const dynamic = "force-dynamic";

async function getImages(): Promise<{ databaseOnline: boolean; images: HusstatusImage[] }> {
  try {
    const submissions = await prisma.formSubmission.findMany({
      where: {
        companyId: "org_rehn_vvs",
        OR: [
          { version: { templateId: "tpl_rvm_husstatus_24" } },
          { inspection: { type: "RVM_HUSSTATUS_24" } },
        ],
      },
      include: {
        answers: true,
        inspection: {
          include: {
            property: {
              include: { customer: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    });

    return { databaseOnline: true, images: extractHusstatusImages(submissions, rvmSections) };
  } catch {
    return { databaseOnline: false, images: [] };
  }
}

function groupByCustomer(images: HusstatusImage[]): CustomerImageGroup[] {
  const groups = new Map<string, HusstatusImage[]>();
  for (const image of images) {
    const key = `${image.customerId}:${image.propertyId}`;
    groups.set(key, [...(groups.get(key) ?? []), image]);
  }
  return Array.from(groups.entries()).map(([key, items]) => {
    const first = items[0];
    return {
      key,
      customerId: first.customerId,
      customerName: first.customerName,
      propertyId: first.propertyId,
      propertyName: first.propertyName,
      address: first.address,
      images: items,
    };
  }).sort((a, b) => a.customerName.localeCompare(b.customerName, "sv"));
}

export default async function AdminImagesPage() {
  const { databaseOnline, images } = await getImages();
  const customerGroups = groupByCustomer(images);
  const customerVisible = images.filter((image) => image.visibility === "CUSTOMER").length;
  const internal = images.length - customerVisible;

  return (
    <main className="adminShell">
      <AdminSidebar active="images" label="Bilder" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Bildbibliotek</p>
            <h1>Alla bilder samlade per kund och fastighet.</h1>
            <p>
              Bilder från formulärfrågor, komponentrader och montörens platsbesiktning hamnar här automatiskt. Varje
              kund får ett eget bibliotek kopplat till sin husrapport och historik.
            </p>
            <div className={`persistenceNote ${databaseOnline ? "online" : "offline"}`}>
              {databaseOnline ? "Bilder läses från sparade RVM-formulär och platsbesiktningar." : "Databasen är offline. Inga bilder kan läsas."}
            </div>
          </div>
          <div className="portalActions">
            <a className="buttonLink" href="/admin/husstatus-form">Fyll i formulär</a>
            <a className="buttonLink" href="/api/admin/images/download">Ladda ner alla bilder</a>
            <a className="buttonLink" href="/portal">Kundportal</a>
          </div>
        </header>

        <section className="adminKpis">
          <article className="portalPanel">
            <span>Bilder</span>
            <strong>{images.length}</strong>
            <small>Från formulär, komponentregister och besiktning</small>
          </article>
          <article className="portalPanel">
            <span>Kunder</span>
            <strong>{customerGroups.length}</strong>
            <small>Med personligt bibliotek</small>
          </article>
          <article className="portalPanel">
            <span>Kundportal</span>
            <strong>{customerVisible}</strong>
            <small>Markerade som kundsynliga</small>
          </article>
          <article className="portalPanel">
            <span>Internt</span>
            <strong>{internal}</strong>
            <small>Endast Rehn VVS</small>
          </article>
        </section>

        <section className="portalPanel imageLibraryPanel">
          <div className="panelTitle">
            <h3>Personliga bibliotek</h3>
            <span>{customerGroups.length} kund/fastighet-grupper</span>
          </div>

          {customerGroups.length === 0 ? (
            <div className="emptyState">
              <strong>Inga bilder sparade än.</strong>
              <span>Lägg in bilder i formuläret, spara eller slutför, så visas de här.</span>
              <a className="buttonLink" href="/admin/husstatus-form">Lägg in bilder</a>
            </div>
          ) : (
            <ImagesView groups={customerGroups} />
          )}
        </section>
      </section>
    </main>
  );
}
