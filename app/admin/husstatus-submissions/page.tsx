import { prisma } from "../../../lib/prisma";
import AdminSidebar from "../admin-sidebar";
import { rvmSections } from "../husstatus-form/spec";

export const dynamic = "force-dynamic";

type AnswerVm = {
  key: string;
  label: string;
  value: string;
  sectionId: number;
};

type ComponentRowVm = {
  typeName: string;
  systemName: string;
  category: string;
  brand: string;
  model: string;
  serialNo: string;
  installedYear: string;
  status: string;
  costKr: string;
};

type SubmissionVm = {
  id: string;
  status: string;
  customerName: string;
  propertyName: string;
  address: string;
  signedAt: string;
  createdAt: string;
  answerCount: number;
  sections: {
    id: number;
    title: string;
    answers: AnswerVm[];
  }[];
  componentRows: ComponentRowVm[];
  propertyId?: string;
};

const fieldLookup = new Map(
  rvmSections.flatMap((section) =>
    section.fields.map((field) => [
      field.key,
      {
        label: field.label,
        sectionId: section.id,
      },
    ]),
  ),
);

const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  dateStyle: "short",
  timeStyle: "short",
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringifyAnswer(value: unknown): string {
  if (isRecord(value) && "value" in value) return stringifyAnswer(value.value);
  if (isRecord(value) && Array.isArray(value.values)) return value.values.map(stringifyAnswer).filter(Boolean).join(", ");
  if (Array.isArray(value)) return value.map(stringifyAnswer).filter(Boolean).join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getComponentRows(value: unknown): ComponentRowVm[] {
  const rows = isRecord(value) && Array.isArray(value.values) ? value.values : [];
  return rows
    .filter(isRecord)
    .map((row) => ({
      typeName: String(row.typeName ?? ""),
      systemName: String(row.systemName ?? ""),
      category: String(row.category ?? ""),
      brand: String(row.brand ?? ""),
      model: String(row.model ?? ""),
      serialNo: String(row.serialNo ?? ""),
      installedYear: String(row.installedYear ?? ""),
      status: String(row.status ?? ""),
      costKr: String(row.costKr ?? ""),
    }))
    .filter((row) => Object.values(row).some(Boolean));
}

async function getSubmissions(): Promise<{ databaseOnline: boolean; submissions: SubmissionVm[] }> {
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
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return {
      databaseOnline: true,
      submissions: submissions.map((submission) => {
        const answers = submission.answers
          .filter((answer) => answer.fieldKey !== "component_register_rows")
          .map((answer) => {
            const meta = fieldLookup.get(answer.fieldKey) ?? {
              label: answer.fieldKey,
              sectionId: 99,
            };

            return {
              key: answer.fieldKey,
              label: meta.label,
              value: stringifyAnswer(answer.value),
              sectionId: meta.sectionId,
            };
          })
          .filter((answer) => answer.value.trim().length > 0);

        const sections = rvmSections.map((section) => ({
          id: section.id,
          title: section.title,
          answers: answers.filter((answer) => answer.sectionId === section.id),
        }));

        const componentAnswer = submission.answers.find((answer) => answer.fieldKey === "component_register_rows");
        const componentRows = componentAnswer ? getComponentRows(componentAnswer.value) : [];
        const property = submission.inspection?.property;

        return {
          id: submission.id,
          status: submission.status,
          customerName: property?.customer.name ?? "-",
          propertyName: property?.propertyNo ?? "Fastighet",
          address: property?.address ?? "-",
          signedAt: submission.signedAt ? dateFormatter.format(submission.signedAt) : "-",
          createdAt: dateFormatter.format(submission.createdAt),
          answerCount: answers.length + componentRows.length,
          sections,
          componentRows,
          propertyId: property?.id,
        };
      }),
    };
  } catch {
    return {
      databaseOnline: false,
      submissions: [],
    };
  }
}

export default async function HusstatusSubmissionsPage() {
  const { databaseOnline, submissions } = await getSubmissions();
  const firstReportUrl = submissions[0]?.propertyId ? `/husrapport?propertyId=${submissions[0].propertyId}` : "/husrapport";

  return (
    <main className="adminShell">
      <AdminSidebar active="husstatusSubmissions" label="Formulärsvar" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">RVM Husstatus</p>
            <h1>Inskickade formulär som fyller Status Husrapport.</h1>
            <p>
              Varje slutfört formulär sparas som inspektion, formulärsvar och komponentunderlag. Status Husrapport
              hämtar den senaste sparade datan från samma databas.
            </p>
          </div>
          <div className="portalActions">
            <a className="buttonLink" href="/admin/husstatus-form">Fyll i nytt</a>
            <a className="buttonLink" href={firstReportUrl}>Visa rapport</a>
            <a className="buttonLink" href="/admin/installations">Installationer</a>
          </div>
        </header>

        {!databaseOnline && (
          <section className="portalPanel customerNotice">
            Databasen kunde inte nås. Starta databasen och kör Prisma innan riktiga formulärsvar kan visas.
          </section>
        )}

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Formulärsvar</h3>
            <span>{submissions.length} sparade</span>
          </div>

          {submissions.length === 0 ? (
            <div className="emptyState">
              <strong>Inga inskickade Husstatus-formulär än.</strong>
              <span>Fyll i ett formulär och slutför det, så dyker det upp här direkt.</span>
              <a className="buttonLink" href="/admin/husstatus-form">Fyll i formulär</a>
            </div>
          ) : (
            <div className="submissionList">
              {submissions.map((submission, index) => (
                <details className="submissionItem" key={submission.id} open={index === 0}>
                  <summary>
                    <span>{submission.status}</span>
                    <strong>{submission.propertyName}</strong>
                    <b>{submission.customerName}</b>
                    <small>{submission.answerCount} svar - {submission.signedAt}</small>
                  </summary>

                  <div className="submissionMeta">
                    <div><span>Adress</span><strong>{submission.address}</strong></div>
                    <div><span>Skapad</span><strong>{submission.createdAt}</strong></div>
                    <div><span>Signerad</span><strong>{submission.signedAt}</strong></div>
                    <div><span>ID</span><strong>{submission.id}</strong></div>
                  </div>

                  <div className="portalActions submissionActions">
                    {submission.propertyId && (
                      <a className="buttonLink" href={`/admin/husstatus-form?propertyId=${submission.propertyId}`}>Nytt formulär på fastighet</a>
                    )}
                    <a className="buttonLink" href={submission.propertyId ? `/husrapport?propertyId=${submission.propertyId}` : "/husrapport"}>Se uppdaterad rapport</a>
                    <a className="buttonLink" href="/admin/installations">Se skapade komponenter</a>
                  </div>

                  {submission.componentRows.length > 0 && (
                    <section className="answerSection">
                      <h4>Installations- och dimensionsregister</h4>
                      <div className="answerComponentTable">
                        <div className="answerComponentHead">
                          <span>Komponent</span>
                          <span>System</span>
                          <span>Fabrikat</span>
                          <span>Modell</span>
                          <span>Serienr</span>
                          <span>År</span>
                          <span>Status</span>
                          <span>Kostnad</span>
                        </div>
                        {submission.componentRows.map((row, rowIndex) => (
                          <div className="answerComponentRow" key={`${row.typeName}-${rowIndex}`}>
                            <span>{row.typeName || "-"}</span>
                            <span>{row.systemName || row.category || "-"}</span>
                            <span>{row.brand || "-"}</span>
                            <span>{row.model || "-"}</span>
                            <span>{row.serialNo || "-"}</span>
                            <span>{row.installedYear || "-"}</span>
                            <span>{row.status || "-"}</span>
                            <span>{row.costKr || "-"}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="answerSections">
                    {submission.sections.map((section) => (
                      <section className="answerSection" key={section.id}>
                        <h4>{section.id}. {section.title}</h4>
                        {section.answers.length > 0 ? (
                          <div className="answerRows">
                            {section.answers.map((answer) => (
                              <div key={answer.key}>
                                <span>{answer.label}</span>
                                <strong>{answer.value}</strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="emptyAnswerSection">Ej ifyllt i sparat underlag.</p>
                        )}
                      </section>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
