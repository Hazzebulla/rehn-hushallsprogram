import { prisma } from "../../../lib/prisma";
import { houseReportStatusLabel, houseReportStatuses, normalizeHouseReportStatus, type HouseReportStatus } from "../../../lib/house-report-status";
import AdminSidebar from "../admin-sidebar";

export const dynamic = "force-dynamic";

const companyId = "org_rehn_vvs";

type ReportsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

async function getReports(status?: string) {
  const selectedStatus = status && houseReportStatuses.includes(status as HouseReportStatus) ? status : "";

  try {
    const reports = await prisma.houseReport.findMany({
      where: {
        companyId,
        ...(selectedStatus ? { status: selectedStatus } : {}),
      },
      include: {
        property: {
          include: {
            customer: true,
            healthScore: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    });

    return {
      databaseOnline: true,
      reports: reports.map((report) => {
        const explanation = report.property.healthScore?.explanation as { risk?: number; nextAction?: string } | undefined;
        return {
          id: report.id,
          propertyId: report.propertyId,
          customer: report.property.customer.name,
          address: report.property.address,
          status: report.status,
          normalizedStatus: normalizeHouseReportStatus(report.status),
          risk: explanation?.risk ?? null,
          nextAction: explanation?.nextAction ?? "Nästa kontroll saknas",
          updatedAt: report.updatedAt.toLocaleDateString("sv-SE"),
        };
      }),
    };
  } catch {
    return { databaseOnline: false, reports: [] };
  }
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const status = params?.status ?? "";
  const { databaseOnline, reports } = await getReports(status);

  return (
    <main className="adminShell">
      <AdminSidebar active="reports" label="Husrapporter" />

      <section className="adminWork">
        <header className="adminTop">
          <div>
            <p className="sectionKicker">RVM Husrapport</p>
            <h1>Husrapporter</h1>
            <p>Samlad lista över rapporter, utkast, granskning och publicerade kundrapporter.</p>
            {!databaseOnline ? <p className="databaseNotice">Databasen svarar inte just nu.</p> : null}
          </div>
          <div className="portalActions">
            <a className="buttonLink primary" href="/admin/new-report">Ny Husrapport</a>
            <a className="buttonLink" href="/admin/husstatus-form">Öppna besiktningsformulär</a>
          </div>
        </header>

        <section className="portalPanel">
          <div className="portalActions compact">
            <a className={!status ? "buttonLink active" : "buttonLink"} href="/admin/reports">Alla</a>
            {houseReportStatuses.map((item) => (
              <a className={status === item ? "buttonLink active" : "buttonLink"} href={`/admin/reports?status=${item}`} key={item}>
                {houseReportStatusLabel(item)}
              </a>
            ))}
          </div>
        </section>

        <section className="portalPanel">
          <div className="panelTitle">
            <h3>Rapportlista</h3>
            <span>{reports.length} rapporter</span>
          </div>
          <div className="auditList reportList">
            {reports.length ? reports.map((report) => (
              <div key={report.id}>
                <time>{report.updatedAt}</time>
                <strong>{report.customer}</strong>
                <span>{report.address}</span>
                <b>{houseReportStatusLabel(report.status)}</b>
                <a className="buttonLink" href={`/husrapport?propertyId=${report.propertyId}`}>Visa</a>
                <a className="buttonLink" href={`/admin/husstatus-form?propertyId=${report.propertyId}`}>Besiktning</a>
              </div>
            )) : (
              <div>
                <time>Tomt</time>
                <strong>Ingen rapport hittades</strong>
                <span>Skapa en ny rapport eller byt filter.</span>
                <a className="buttonLink" href="/admin/new-report">Ny Husrapport</a>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
