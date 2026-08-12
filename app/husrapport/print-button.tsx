"use client";

type PrintReportButtonProps = {
  dataHref: string;
  formDataPdfHref: string;
  disabled?: boolean;
};

function printWithMode(mode: "customer" | "full") {
  document.body.classList.toggle("customerPrint", mode === "customer");
  window.print();
  window.setTimeout(() => document.body.classList.remove("customerPrint"), 500);
}

export default function PrintReportButton({ dataHref, formDataPdfHref, disabled = false }: PrintReportButtonProps) {
  return (
    <>
      <button disabled={disabled} onClick={() => printWithMode("customer")} type="button">
        Kundblad PDF
      </button>
      <button disabled={disabled} onClick={() => printWithMode("full")} type="button">
        Full rapport PDF
      </button>
      <a className="buttonLink" href={formDataPdfHref}>
        Formulärdata PDF
      </a>
      <a className="buttonLink" href={dataHref}>
        Ladda ner data
      </a>
    </>
  );
}
