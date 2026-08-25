"use client";

import { useState } from "react";

type AdminSidebarProps = {
  active:
    | "admin"
    | "access"
    | "foundation"
    | "customers"
    | "properties"
    | "newReport"
    | "reports"
    | "pricing"
    | "products"
    | "installations"
    | "energyAnalysis"
    | "huschecks"
    | "husstatusForm"
    | "husstatusSubmissions"
    | "reportImport"
    | "requests"
    | "workorders"
    | "invoicing"
    | "documents"
    | "images"
    | "history"
    | "backup"
    | "gdpr"
    | "legal"
    | "settings";
  label?: string;
};

const mainLinks = [
  ["admin", "/admin", "Översikt"],
  ["customers", "/admin/customers", "Kunder & Fastigheter"],
  ["newReport", "/admin/new-report", "Ny Husrapport"],
  ["reports", "/admin/reports", "Husrapporter"],
  ["pricing", "/admin/pricing", "Prisdatabas"],
  ["settings", "/admin/settings", "Inställningar"],
] as const;

const publicLinks = [
  ["/", "Omslag"],
  ["/husrapport", "Status Husrapport"],
  ["/huscheck", "Huscheck"],
  ["/portal", "Kundkonto"],
  ["/login", "Inloggning"],
] as const;

export default function AdminSidebar({ active, label = "Rehn VVS" }: AdminSidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <button
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Stäng meny" : "Öppna meny"}
        className="adminMenuToggle"
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>
      {menuOpen && <button aria-label="Stäng meny" className="adminMenuBackdrop" onClick={() => setMenuOpen(false)} type="button" />}
      <aside className={`adminSide ${menuOpen ? "open" : ""}`}>
        <div className="brandLine">
          <div className="miniMark" />
          <div>
            <strong>RVM Husrapport</strong>
            <span>{label}</span>
          </div>
        </div>

        <nav aria-label="Admin navigation">
          <div className="adminSideGroup">
            <span>Husrapport</span>
            {mainLinks.map(([key, href, title]) => (
              <a className={active === key ? "active" : ""} href={href} key={key} onClick={() => setMenuOpen(false)}>
                {title}
              </a>
            ))}
          </div>

          <div className="adminSideGroup public">
            <span>Kundvy</span>
            {publicLinks.map(([href, title]) => (
              <a href={href} key={href} onClick={() => setMenuOpen(false)}>
                {title}
              </a>
            ))}
          </div>
        </nav>
      </aside>
    </>
  );
}
