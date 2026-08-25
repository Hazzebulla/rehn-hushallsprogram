import { emptyInspectionState } from "../../../lib/technician-inspection";
import TechnicianInspectionView from "../../admin/inspection/[reportId]/view";

export const dynamic = "force-dynamic";

export default function DemoInspectionPage() {
  const initialState = {
    ...emptyInspectionState("demo-report", "demo-property", "Demo montör"),
    status: "inspection_in_progress" as const,
    startedAt: new Date().toISOString(),
  };
  const report = {
    id: "demo-report",
    reportNo: "RVM-HS-DEMO",
    status: "customer_form_completed",
    propertyId: "demo-property",
    customerName: "Demo Kund",
    address: "Testvägen 12, Timrå",
    buildYear: "1978",
    heating: "Bergvärme",
    customerCompletion: 27,
    customerRows: [
      ["Fastighetstyp", "Villa"],
      ["Byggår", "1978"],
      ["Boyta", "142 m²"],
      ["Värmekälla", "Bergvärme"],
      ["Värmedistribution", "Radiatorer, Golvvärme"],
      ["Badrum/WC", "2"],
      ["Kända problem", "Problem med varmvatten"],
      ["Önskad kontroll", "Varmvattenberedare, lågt vattentryck"],
    ],
  };

  return (
    <main className="adminShell demoInspectionShell">
      <TechnicianInspectionView
        initialState={initialState}
        productOptions={[
          {
            id: "demo-product-1",
            manufacturer: "FM Mattsson",
            modelName: "9000E II",
            category: "Blandare",
            technicalInfo: "Energisparfunktion, köksblandare",
            replacementPriceMinSek: 1800,
            replacementPriceMaxSek: 2800,
            sourceText: "8344302 FM Mattsson 9000E",
          },
          {
            id: "demo-product-2",
            manufacturer: "NIBE",
            modelName: "F730",
            category: "Värmepump",
            technicalInfo: "Frånluftsvärmepump",
            replacementPriceMinSek: 98000,
            replacementPriceMaxSek: 135000,
            sourceText: "NIBE F730 värmepump",
          },
        ]}
        report={report}
      />
    </main>
  );
}
