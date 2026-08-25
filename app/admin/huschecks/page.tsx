import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

type HuscheckVm = {
  id: string;
  customerName: string;
  address: string;
  createdAt: string;
  preliminaryStatus: string;
  problemCount: number;
  bookedControl: string;
  propertyId: string;
};

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function answerPayload(value: unknown) {
  if (!isRecord(value)) return undefined;
  return value.value ?? value.values;
}

function preliminaryStatus(problemCount: number) {
  if (problemCount >= 3) return "Flera punkter att kontrollera";
  if (problemCount >= 1) return "Kontroll rekommenderas";
  return "Inga tydliga problem rapporterade";
}

async function getHuschecks(): Promise<{ databaseOnline: boolean; items: HuscheckVm[] }> {
  try {
    const submissions = await prisma.formSubmission.findMany({
      where: {
        companyId: "org_rehn_vvs",
        answers: { some: { fieldKey: "customer_self_declaration" } },
      },
      include: {
        answers: true,
        inspection: {
          include: {
            property: { include: { customer: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return {
      databaseOnline: true,
      items: submissions.flatMap((submission) => {
        const property = submission.inspection?.property;
        if (!property) return [];
        const selfDeclaration = submission.answers.find((answer) => answer.fieldKey === "customer_self_declaration");
        const payload = answerPayload(selfDeclaration?.value);
        const problems = isRecord(payload) && Array.isArray(payload.problems) ? payload.problems.filter((item) => item !== "Inga kända problem") : [];
        const bookedControl = isRecord(payload) && payload.bookedControl === true ? "Ja" : "Nej";

        return [{
          id: submission.id,
          customerName: property.customer.name,
          address: property.address,
          createdAt: dateFormatter.format(submission.createdAt),
          preliminaryStatus: preliminaryStatus(problems.length),
          problemCount: problems.length,
          bookedControl,
          propertyId: property.id,
        }];
      }),
    };
  } catch {
    return { databaseOnline: false, items: [] };
  }
}

export default async function AdminHuschecksPage() {
  const { databaseOnline, items } = await getHuschecks();

  return (
    <main className="adminShell">
      <AdminSidebar active="huschecks" label="Nya Huscheckar" />
      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">Kundens självdeklaration</p>
            <h1>Nya Huscheckar</h1>
            <p>
              Kundens uppgifter sparas som Husrapport-utkast och är markerade som kunduppgift, ej verifierad.
              Klicka vidare för att öppna montörens formulär på samma fastighet.
            </p>
          </div>
          <div className="portalActions">
            <a className="buttonLink" href="/huscheck">Öppna publik Huscheck</a>
            <a className="buttonLink" href="/admin/husstatus-form">Montörsformulär</a>
          </div>
        </header>

        {!databaseOnline ? (
          <section className="portalPanel customerNotice">
            Databasen kunde inte nås. Nya Huscheckar visas när databasen är online.
          </section>
        ) : null}

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Inkomna kundunderlag</h3>
            <span>{items.length} st</span>
          </div>

          {items.length === 0 ? (
            <div className="emptyState">
              <strong>Inga Huscheckar inskickade än.</strong>
              <span>När en kund skickar in `/huscheck` hamnar underlaget här.</span>
              <a className="buttonLink" href="/huscheck">Testa kundflödet</a>
            </div>
          ) : (
            <div className="huscheckAdminList">
              <div className="huscheckAdminHead">
                <span>Kund</span>
                <span>Adress</span>
                <span>Datum</span>
                <span>Preliminär status</span>
                <span>Problem</span>
                <span>Bokat</span>
                <span />
              </div>
              {items.map((item) => (
                <article key={item.id}>
                  <strong>{item.customerName}</strong>
                  <span>{item.address}</span>
                  <span>{item.createdAt}</span>
                  <span>{item.preliminaryStatus}</span>
                  <b>{item.problemCount}</b>
                  <span>{item.bookedControl}</span>
                  <a className="buttonLink" href={`/admin/husstatus-form?propertyId=${item.propertyId}`}>Öppna utkast</a>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
