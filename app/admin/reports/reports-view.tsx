"use client";

import { useState } from "react";
import { houseReportStatusLabel } from "../../../lib/house-report-status";

export type ReportAnswerItem = {
  key: string;
  label: string;
  value: string;
  answered: boolean;
};

export type ReportAnswerGroup = {
  id: string;
  title: string;
  items: ReportAnswerItem[];
};

export type ReportImageVm = {
  id: string;
  title: string;
  fileName: string;
  dataUrl: string;
  createdAt: string;
};

export type ReportAnswerDetails = {
  summaryText: string;
  answeredQuestions: number;
  totalQuestions: number;
  imageCount: number;
  problemCount: number;
  answerGroups: ReportAnswerGroup[];
  extraAnswers: ReportAnswerItem[];
  images: ReportImageVm[];
};

export type AdminReportVm = {
  id: string;
  propertyId: string;
  customer: string;
  address: string;
  status: string;
  normalizedStatus: string;
  risk: number | null;
  nextAction: string;
  updatedAt: string;
};

function statusClass(status: string) {
  if (status === "published") return "published";
  if (status === "review_required") return "review";
  if (status === "inspection_in_progress") return "progress";
  if (status === "customer_form_completed") return "ready";
  return "draft";
}

export default function ReportsView({
  reports,
}: {
  reports: AdminReportVm[];
}) {
  const [openReportId, setOpenReportId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<ReportImageVm | null>(null);
  const [detailsByReportId, setDetailsByReportId] = useState<Record<string, ReportAnswerDetails>>({});
  const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
  const [errorByReportId, setErrorByReportId] = useState<Record<string, string>>({});

  async function toggleCustomerAnswers(reportId: string) {
    if (openReportId === reportId) {
      setOpenReportId(null);
      return;
    }
    setOpenReportId(reportId);
    if (detailsByReportId[reportId]) return;

    setLoadingReportId(reportId);
    setErrorByReportId((current) => ({ ...current, [reportId]: "" }));
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/customer-answers`, { cache: "no-store" });
      if (!response.ok) throw new Error("Kundsvaren kunde inte hämtas.");
      const payload = await response.json() as ReportAnswerDetails;
      setDetailsByReportId((current) => ({ ...current, [reportId]: payload }));
    } catch {
      setErrorByReportId((current) => ({ ...current, [reportId]: "Kundsvaren kunde inte hämtas just nu." }));
    } finally {
      setLoadingReportId(null);
    }
  }

  return (
    <>
      <div className="modernReportList">
        {reports.length ? reports.map((report) => {
          const isOpen = openReportId === report.id;
          return (
            <article className={isOpen ? "reportCard open" : "reportCard"} key={report.id}>
              <div className="reportCardMain">
                <time>{report.updatedAt}</time>
                <div>
                  <strong>{report.customer}</strong>
                  <span>{report.address}</span>
                </div>
                <b className={`reportStatusBadge ${statusClass(report.normalizedStatus)}`}>{houseReportStatusLabel(report.status)}</b>
                <div className="reportMiniStats">
                  {detailsByReportId[report.id] ? (
                    <>
                      <span>{detailsByReportId[report.id].answeredQuestions}/{detailsByReportId[report.id].totalQuestions} svar</span>
                      <span>{detailsByReportId[report.id].imageCount} bilder</span>
                      <span>{detailsByReportId[report.id].problemCount} problem</span>
                    </>
                  ) : (
                    <>
                      <span>Kundsvar finns bakom knappen</span>
                      <span>{report.risk !== null ? `${report.risk} % risk` : "Risk ej bedömd"}</span>
                    </>
                  )}
                </div>
                <div className="reportActions">
                  <a className="buttonLink" href={`/husrapport?propertyId=${report.propertyId}`}>Visa</a>
                  <a className="buttonLink" href={`/admin/inspection/${report.id}`}>Besiktning</a>
                  <button className="buttonLink" disabled={loadingReportId === report.id} onClick={() => toggleCustomerAnswers(report.id)} type="button">
                    {isOpen ? "Dölj kundsvar" : loadingReportId === report.id ? "Hämtar..." : "Visa kundsvar"}
                  </button>
                </div>
              </div>

              {isOpen ? (
                <section className="customerAnswersPanel">
                  {errorByReportId[report.id] ? <p className="databaseNotice">{errorByReportId[report.id]}</p> : null}
                  {!detailsByReportId[report.id] && !errorByReportId[report.id] ? <p>Hämtar kundsvar...</p> : null}
                  {detailsByReportId[report.id] ? <CustomerAnswerDetails details={detailsByReportId[report.id]} report={report} onOpenImage={setLightbox} /> : null}
                </section>
              ) : null}
            </article>
          );
        }) : (
          <article className="reportCard">
            <div className="reportCardMain empty">
              <time>Tomt</time>
              <div>
                <strong>Ingen rapport hittades</strong>
                <span>Skapa en ny rapport eller byt filter.</span>
              </div>
              <a className="buttonLink" href="/admin/new-report">Ny Husrapport</a>
            </div>
          </article>
        )}
      </div>

      {lightbox ? (
        <div className="reportImageLightbox" onClick={() => setLightbox(null)} role="presentation">
          <figure onClick={(event) => event.stopPropagation()}>
            <img alt={lightbox.title || lightbox.fileName} src={lightbox.dataUrl} />
            <figcaption>
              <strong>{lightbox.title}</strong>
              <span>{lightbox.fileName}</span>
              <button className="buttonLink" onClick={() => setLightbox(null)} type="button">Stäng</button>
            </figcaption>
          </figure>
        </div>
      ) : null}
    </>
  );
}

function CustomerAnswerDetails({
  details,
  report,
  onOpenImage,
}: {
  details: ReportAnswerDetails;
  report: AdminReportVm;
  onOpenImage: (image: ReportImageVm) => void;
}) {
  return (
    <>
      <div className="customerAnswerSummary">
        <strong>{details.summaryText}</strong>
        <span>Nästa steg: {report.nextAction}</span>
        {report.risk !== null ? <span>Riskindex: {report.risk} %</span> : <span>Riskindex: Ej bedömt</span>}
      </div>

      <div className="customerAnswerGroups">
        {details.answerGroups.map((group) => (
          <section className="customerAnswerGroup" key={group.id}>
            <h4>{group.title}</h4>
            <dl>
              {group.items.map((item) => (
                <div className={!item.answered ? "unanswered" : ""} key={item.key}>
                  <dt>{item.label}</dt>
                  <dd>{item.answered ? item.value : "Ej besvarat"}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {details.extraAnswers.length ? (
          <section className="customerAnswerGroup">
            <h4>Övriga sparade kundsvar</h4>
            <dl>
              {details.extraAnswers.map((item) => (
                <div key={item.key}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      <section className="customerAnswerImages">
        <div className="panelTitle">
          <h3>Bilder</h3>
          <span>{details.images.length} bilder från formulär och rapportunderlag</span>
        </div>
        {details.images.length ? (
          <div className="reportImageGrid">
            {details.images.map((image) => (
              <button key={image.id} onClick={() => onOpenImage(image)} type="button">
                <img alt={image.title || image.fileName} src={image.dataUrl} />
                <span>{image.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <p>Inga bilder har laddats upp för den här rapporten.</p>
        )}
      </section>
    </>
  );
}
