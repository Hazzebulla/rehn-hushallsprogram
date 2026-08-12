"use client";

import { useState } from "react";

type AdminSidebarProps = {
  active:
    | "admin"
    | "access"
    | "foundation"
    | "customers"
    | "properties"
    | "installations"
    | "energyAnalysis"
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
    | "legal";
  label?: string;
};

const mainLinks = [
  ["admin", "/admin", "Översikt"],
  ["customers", "/admin/customers", "Kunder"],
  ["properties", "/admin/properties", "Fastigheter"],
  ["installations", "/admin/installations", "Installationer"],
  ["energyAnalysis", "/admin/energy-analysis", "Energianalys värme"],
  ["husstatusForm", "/admin/husstatus-form", "Fyll i formulär"],
  ["husstatusSubmissions", "/admin/husstatus-submissions", "Formulärsvar"],
  ["reportImport", "/admin/report-import", "Rapportimport"],
  ["requests", "/admin/requests", "Ärenden"],
  ["workorders", "/admin/workorders", "Arbetsorder"],
  ["invoicing", "/admin/invoicing", "Fakturaunderlag"],
  ["documents", "/admin/documents", "Dokument"],
  ["images", "/admin/images", "Bilder"],
] as const;

const systemLinks = [
  ["access", "/admin/access", "Åtkomst"],
  ["foundation", "/admin/foundation", "Fundament"],
  ["history", "/admin/history", "Historik"],
  ["backup", "/admin/backup", "Backup"],
  ["gdpr", "/admin/gdpr", "GDPR"],
  ["legal", "/admin/legal", "Lagligt"],
] as const;

const publicLinks = [
  ["/", "Omslag"],
  ["/husrapport", "Status Husrapport"],
  ["/portal", "Kundkonto"],
  ["/login", "Inloggning"],
] as const;

export default function AdminSidebar({ active, label = "Rehn VVS" }: AdminSidebarProps) {
  const systemOpen = systemLinks.some(([key]) => key === active);
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
            <strong>RVM SaaS</strong>
            <span>{label}</span>
          </div>
        </div>

        <nav aria-label="Admin navigation">
          <div className="adminSideGroup">
            <span>Arbete</span>
            {mainLinks.map(([key, href, title]) => (
              <a className={active === key ? "active" : ""} href={href} key={key} onClick={() => setMenuOpen(false)}>
                {title}
              </a>
            ))}
          </div>

          <details className="adminSideGroup system" open={systemOpen}>
            <summary>System</summary>
            {systemLinks.map(([key, href, title]) => (
              <a className={active === key ? "active" : ""} href={href} key={key} onClick={() => setMenuOpen(false)}>
                {title}
              </a>
            ))}
          </details>

          <div className="adminSideGroup public">
            <span>Demo</span>
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
