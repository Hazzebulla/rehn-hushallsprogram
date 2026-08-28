import type { Metadata } from "next";
import { prisma } from "../../../lib/prisma";
import { isPublishedReportStatus } from "../../../lib/public-report-access";
import HusrapportPage from "../../husrapport/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

type PublicReportPageProps = {
  params: Promise<{ token: string }>;
};

function UnavailableReport() {
  return (
    <main className="statusReport publicReportMode">
      <section className="publicReportUnavailable">
        <div>
          <p className="sectionKicker">RVM Husstatus</p>
          <h1>Rapporten är inte tillgänglig</h1>
          <p>Den här rapporten är inte längre tillgänglig. Kontakta Rehn VVS & Montage om du behöver hjälp.</p>
        </div>
      </section>
    </main>
  );
}

export default async function PublicReportPage({ params }: PublicReportPageProps) {
  const { token } = await params;
  if (!token || token.length < 32) return <UnavailableReport />;

  const report = await prisma.houseReport.findFirst({
    where: { publicAccessToken: token },
    select: {
      id: true,
      status: true,
      publicAccessEnabled: true,
      companyId: true,
    },
  });

  if (!report || report.companyId !== "org_rehn_vvs" || !report.publicAccessEnabled || !isPublishedReportStatus(report.status)) {
    return <UnavailableReport />;
  }

  return <HusrapportPage publicMode publicReportId={report.id} />;
}
