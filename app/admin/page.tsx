import { prisma } from "../../lib/prisma";
import { houseReportStatusLabel, normalizeHouseReportStatus } from "../../lib/house-report-status";
import AdminSidebar from "./admin-sidebar";

export const dynamic = "force-dynamic";

const companyId = "org_rehn_vvs";

type DashboardReport = {
  id: string;
  propertyId: string;
  customer: string;
  address: string;
  status: string;
  updatedAt: string;
};

type DashboardData = {
  databaseOnline: boolean;
  customerFormStarted: number;
  customerFormCompleted: number;
  visitsScheduled: number;
  inspectionInProgress: number;
  reviewRequired: number;
  publishedThisMonth: number;
  highRiskIssues: number;
  recentReports: DashboardReport[];
};

async function getDashboardData(): Promise<DashboardData> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  try {
    const [
      customerFormStarted,
      customerFormCompleted,
      visitsScheduled,
      inspectionInProgress,
      reviewRequired,
      publishedThisMonth,
      highRiskIssues,
      reports,
    ] = await Promise.all([
      prisma.formSubmission.count({ where: { companyId, status: "DRAFT" } }),
      prisma.formSubmission.count({ where: { companyId, status: { not: "DRAFT" } } }),
      prisma.houseReport.count({ where: { companyId, status: "visit_scheduled" } }),
      prisma.houseReport.count({ where: { companyId, status: "inspection_in_progress" } }),
      prisma.houseReport.count({ where: { companyId, status: { in: ["review_required", "READY_FOR_REVIEW", "SUBMITTED"] } } }),
      prisma.houseReport.count({ where: { companyId, status: "published", publishedAt: { gte: monthStart } } }),
      prisma.component.count({ where: { companyId, riskLevel: "HIGH" } }),
      prisma.houseReport.findMany({
        where: { companyId },
        include: {
          property: {
            include: {
              customer: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
    ]);

    return {
      databaseOnline: true,
      customerFormStarted,
      customerFormCompleted,
      visitsScheduled,
      inspectionInProgress,
      reviewRequired,
      publishedThisMonth,
      highRiskIssues,
      recentReports: reports.map((report) => ({
        id: report.id,
        propertyId: report.propertyId,
        customer: report.property.customer.name,
        address: report.property.address,
        status: report.status,
        updatedAt: report.updatedAt.toLocaleDateString("sv-SE"),
      })),
    };
  } catch {
    return {
      databaseOnline: false,
      customerFormStarted: 0,
      customerFormCompleted: 0,
      visitsScheduled: 0,
      inspectionInProgress: 0,
      reviewRequired: 0,
      publishedThisMonth: 0,
      highRiskIssues: 0,
      recentReports: [],
    };
  }
}

const workflow = [
  ["1", "Kund", "Kunduppgifter och eventuell självdeklaration"],
  ["2", "Fastighet", "Adress, byggår, system och grunddata"],
  ["3", "Husrapport", "Rapportutkast kopplat till en fastighet"],
  ["4", "Besiktning", "Montörens genomgång på plats"],
  ["5", "Brister, produkter och bilder", "Underlag som fyller rapporten"],
  ["6", "Granskning", "Kontroll innan kunden får rapporten"],
  ["7", "Publicerad kundrapport", "Låst kundvy och PDF/utskrift"],
];

export default async function AdminPage() {
  const data = await getDashboardData();

  const kpis = [
    ["Kundformulär", data.customerFormStarted, "Påbörjade underlag"],
    ["Besök", data.visitsScheduled, "Bokade platsbesök"],
    ["Pågående", data.inspectionInProgress, "Rapporter under arbete"],
    ["Granskning", data.reviewRequired, "Väntar på kontroll"],
    ["Publicerade", data.publishedThisMonth, "Denna månad"],
    ["Högrisk", data.highRiskIssues, "Brister att prioritera"],
  ];

  return (
    <main className="adminShell">
      <AdminSidebar active="admin" label="Husrapport" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">RVM Husrapport</p>
            <h1>Översikt för kunder, fastigheter och husrapporter.</h1>
            <p>
              Det synliga systemet är nu fokuserat på ett arbetsflöde: kund, fastighet, ny Husrapport,
              besiktning, brister, produkter, bilder, granskning och publicerad kundrapport.
            </p>
            {!data.databaseOnline ? <p className="databaseNotice">Databasen svarar inte just nu. Sidan visas utan live-data.</p> : null}
          </div>
          <div className="portalActions">
            <a className="buttonLink primary" href="/admin/new-report">Ny Husrapport</a>
            <a className="buttonLink" href="/admin/reports">Husrapporter</a>
            <a className="buttonLink" href="/admin/customers">Kunder & Fastigheter</a>
          </div>
        </header>

        <section className="adminKpis">
          {kpis.map(([label, value, detail]) => (
            <article className="portalPanel" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </article>
          ))}
        </section>

        <section className="adminGrid lower">
          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Arbetsflöde</h3>
              <span>Det montören och kontoret ska följa</span>
            </div>
            <div className="queue">
              {workflow.map(([step, title, detail]) => (
                <div key={step}>
                  <span>{step}</span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="portalPanel">
            <div className="panelTitle">
              <h3>Senaste husrapporter</h3>
              <span>Status per kund och fastighet</span>
            </div>
            <div className="auditList">
              {data.recentReports.length ? data.recentReports.map((report) => (
                <div key={report.id}>
                  <time>{report.updatedAt}</time>
                  <strong>{report.customer}</strong>
                  <span>{houseReportStatusLabel(report.status)}</span>
                  <a className="buttonLink" href={`/husrapport?propertyId=${report.propertyId}`}>Öppna</a>
                </div>
              )) : (
                <div>
                  <time>Ingen</time>
                  <strong>Rapport saknas</strong>
                  <span>Skapa första Husrapporten</span>
                  <a className="buttonLink" href="/admin/new-report">Starta</a>
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Statusmodell</h3>
            <span>Samma status kan användas i listor, kundvy och rapportflöde</span>
          </div>
          <div className="opsGrid">
            {[
              "customer_form_started",
              "customer_form_completed",
              "visit_scheduled",
              "inspection_in_progress",
              "review_required",
              "published",
              "archived",
            ].map((status) => (
              <div key={status}>
                <strong>{houseReportStatusLabel(status)}</strong>
                <span>{normalizeHouseReportStatus(status)}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
