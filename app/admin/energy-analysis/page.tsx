import AdminSidebar from "../admin-sidebar";
import EnergyAnalysisView from "./view";

export const dynamic = "force-dynamic";

export default function EnergyAnalysisPage() {
  return (
    <main className="adminShell">
      <AdminSidebar active="energyAnalysis" label="Energianalys värme" />
      <EnergyAnalysisView />
    </main>
  );
}
