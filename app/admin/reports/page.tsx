import { prisma } from "../../../lib/prisma";
import { houseReportStatusLabel, houseReportStatuses, normalizeHouseReportStatus, type HouseReportStatus } from "../../../lib/house-report-status";
import AdminSidebar from "../admin-sidebar";
import ReportsView, { type AdminReportVm } from "./reports-view";

export const dynamic = "force-dynamic";

const companyId = "org_rehn_vvs";

type ReportsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

async function getReports(status?: string) {
  const selectedStatus = status && houseReportStatuses.includes(status as HouseReportStatus) ? status : "";

  try {
    const properties = await prisma.property.findMany({
      where: { companyId },
      include: {
        customer: true,
        healthScore: true,
        houseReports: {
          orderBy: { updatedAt: "desc" },
        },
        inspections: {
          include: {
            submissions: {
              orderBy: { updatedAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    });

    const rows = properties.flatMap((property): AdminReportVm[] => {
      const explanation = property.healthScore?.explanation as { risk?: number; nextAction?: string } | undefined;
      const latestSubmission = property.inspections
        .flatMap((inspection) => inspection.submissions)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];

      if (!property.houseReports.length) {
        const normalizedStatus: HouseReportStatus = latestSubmission?.status === "SUBMITTED"
          ? "customer_form_completed"
          : "customer_form_started";
        const updatedAt = latestSubmission?.updatedAt ?? property.updatedAt;
        return [{
          id: `property-${property.id}`,
          propertyId: property.id,
          hasReport: false,
          customer: property.customer.name,
          address: property.address,
          status: normalizedStatus,
          normalizedStatus,
          risk: explanation?.risk ?? null,
          nextAction: latestSubmission?.status === "SUBMITTED" ? "Skapa Husrapport" : "Fortsätt formuläret",
          updatedAt: updatedAt.toLocaleDateString("sv-SE"),
          updatedAtValue: updatedAt.getTime(),
          publishedAt: "",
          publicAccessEnabled: false,
          publicAccessToken: "",
        }];
      }

      return property.houseReports.map((report): AdminReportVm => ({
        id: report.id,
        propertyId: property.id,
        hasReport: true,
        customer: property.customer.name,
        address: property.address,
        status: report.status,
        normalizedStatus: normalizeHouseReportStatus(report.status),
        risk: explanation?.risk ?? null,
        nextAction: explanation?.nextAction ?? "Nästa kontroll saknas",
        updatedAt: report.updatedAt.toLocaleDateString("sv-SE"),
        updatedAtValue: report.updatedAt.getTime(),
        publishedAt: report.publishedAt?.toLocaleDateString("sv-SE") ?? "",
        publicAccessEnabled: report.publicAccessEnabled,
        publicAccessToken: report.publicAccessToken ?? "",
      }));
    })
      .filter((row) => !selectedStatus || row.normalizedStatus === selectedStatus)
      .sort((left, right) => right.updatedAtValue - left.updatedAtValue)
      .slice(0, 80);

    return {
      databaseOnline: true,
      reports: rows,
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
            <span>{reports.length} kunder / fastigheter</span>
          </div>
          <ReportsView reports={reports} />
        </section>
      </section>
    </main>
  );
}
