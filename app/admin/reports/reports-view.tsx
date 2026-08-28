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

type MailTemplateVariant = "short" | "standard" | "detailed";

type SummaryMailPreview = {
  recipient: string;
  subject: string;
  bodyText: string;
  reportUrl?: string;
  reportPublished: boolean;
  reportVersion?: number | null;
  template: MailTemplateVariant;
  providerConfigured: boolean;
  customerName: string;
  propertyLabel: string;
  reportStatus: string;
  latestMail?: {
    sentAt: string | null;
    createdAt: string;
    status: string;
    subject: string;
    reportVersion: number | null;
    changedSinceLastSend: boolean;
  } | null;
  pdfAvailable: boolean;
  pdfUrl: string;
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
  const [mailReportId, setMailReportId] = useState<string | null>(null);
  const [mailPreview, setMailPreview] = useState<SummaryMailPreview | null>(null);
  const [mailTemplate, setMailTemplate] = useState<MailTemplateVariant>("standard");
  const [mailIncludeReportLink, setMailIncludeReportLink] = useState(true);
  const [mailAttachPdf, setMailAttachPdf] = useState(false);
  const [mailLoading, setMailLoading] = useState(false);
  const [mailSending, setMailSending] = useState(false);
  const [mailMessage, setMailMessage] = useState("");

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

  async function openMailPreview(reportId: string, template: MailTemplateVariant = mailTemplate) {
    setMailReportId(reportId);
    setMailTemplate(template);
    setMailLoading(true);
    setMailMessage("");
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/mail-summary?template=${template}`, { cache: "no-store" });
      const payload = await response.json() as SummaryMailPreview | { message?: string };
      if (!response.ok) throw new Error("message" in payload ? payload.message : "Mailet kunde inte förberedas.");
      const preview = payload as SummaryMailPreview;
      setMailPreview(preview);
      setMailIncludeReportLink(preview.reportPublished);
      setMailAttachPdf(false);
    } catch (error) {
      setMailPreview(null);
      setMailMessage(error instanceof Error ? error.message : "Mailet kunde inte förberedas.");
    } finally {
      setMailLoading(false);
    }
  }

  async function changeMailTemplate(template: MailTemplateVariant) {
    if (!mailReportId) return;
    await openMailPreview(mailReportId, template);
  }

  function updateMailPreview(patch: Partial<Pick<SummaryMailPreview, "recipient" | "subject" | "bodyText">>) {
    setMailPreview((current) => current ? { ...current, ...patch } : current);
  }

  async function submitMail(action: "draft" | "send" | "publish") {
    if (!mailReportId || !mailPreview) return;
    setMailSending(true);
    setMailMessage("");
    try {
      const response = await fetch(`/api/admin/reports/${mailReportId}/mail-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          template: mailTemplate,
          recipient: mailPreview.recipient,
          subject: mailPreview.subject,
          bodyText: mailPreview.bodyText,
          includeReportLink: mailIncludeReportLink,
          attachPdf: mailAttachPdf,
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Åtgärden kunde inte slutföras.");
      if (action === "publish") {
        const preview = payload as SummaryMailPreview & { message?: string };
        setMailPreview(preview);
        setMailIncludeReportLink(preview.reportPublished);
      }
      setMailMessage(payload.message ?? (action === "send" ? "Sammanfattningen är skickad." : action === "publish" ? "Rapporten publicerades." : "Utkastet sparades."));
      if (action === "send") {
        await openMailPreview(mailReportId, mailTemplate);
      }
    } catch (error) {
      setMailMessage(error instanceof Error ? error.message : "Åtgärden kunde inte slutföras.");
    } finally {
      setMailSending(false);
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
                  <a className="buttonLink" href={`/husrapport?reportId=${report.id}`}>Visa</a>
                  <a className="buttonLink" href={`/admin/inspection/${report.id}`}>Besiktning</a>
                  <a className="buttonLink" href={`/admin/husstatus-form?reportId=${report.id}`}>Formulär</a>
                  <button className="buttonLink" disabled={mailLoading && mailReportId === report.id} onClick={() => openMailPreview(report.id, "standard")} type="button">
                    {mailLoading && mailReportId === report.id ? "Förbereder..." : "Maila sammanfattning"}
                  </button>
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

      {mailReportId ? (
        <div className="mailModalBackdrop" onClick={() => { setMailReportId(null); setMailPreview(null); }} role="presentation">
          <section className="mailModal" onClick={(event) => event.stopPropagation()}>
            <div className="panelTitle">
              <div>
                <p className="sectionKicker">Kundutskick</p>
                <h3>Maila sammanfattning</h3>
              </div>
              <button className="buttonLink" onClick={() => { setMailReportId(null); setMailPreview(null); }} type="button">Avbryt</button>
            </div>

            {mailMessage ? <p className="mailWarning">{mailMessage}</p> : null}
            {mailLoading ? <p>Förbereder sammanfattningen...</p> : null}

            {mailPreview ? (
              <>
                <div className="mailTemplateTabs" aria-label="Mailmall">
                  <button className={mailTemplate === "short" ? "active" : ""} onClick={() => changeMailTemplate("short")} type="button">Kort</button>
                  <button className={mailTemplate === "standard" ? "active" : ""} onClick={() => changeMailTemplate("standard")} type="button">Standard</button>
                  <button className={mailTemplate === "detailed" ? "active" : ""} onClick={() => changeMailTemplate("detailed")} type="button">Detaljerad</button>
                </div>

                <div className="mailPreviewGrid">
                  <label>
                    <span>Mottagare</span>
                    <input value={mailPreview.recipient} onChange={(event) => updateMailPreview({ recipient: event.target.value })} type="email" />
                  </label>
                  <label>
                    <span>Ämne</span>
                    <input value={mailPreview.subject} onChange={(event) => updateMailPreview({ subject: event.target.value })} />
                  </label>
                </div>

                {!mailPreview.reportPublished ? (
                  <div className="mailWarning mailWarningSplit">
                    <span>Rapporten är inte publicerad ännu. Skicka utan rapportlänk eller publicera rapporten först.</span>
                    <button disabled={mailSending} onClick={() => submitMail("publish")} type="button">Publicera och fortsätt</button>
                  </div>
                ) : null}
                {mailPreview.latestMail?.changedSinceLastSend ? (
                  <p className="mailWarning">Rapporten har ändrats sedan senaste kundutskicket.</p>
                ) : null}
                {!mailPreview.providerConfigured ? (
                  <p className="mailWarning">RESEND_API_KEY saknas. Utkast kan sparas, men riktiga mail skickas först när mailprovider är konfigurerad.</p>
                ) : null}

                <label className="mailOption">
                  <input checked={mailIncludeReportLink} disabled={!mailPreview.reportPublished} onChange={(event) => setMailIncludeReportLink(event.target.checked)} type="checkbox" />
                  <span>Ta med länk till fullständig Husstatus</span>
                </label>
                <label className="mailOption">
                  <input checked={mailAttachPdf} disabled={!mailPreview.pdfAvailable} onChange={(event) => setMailAttachPdf(event.target.checked)} type="checkbox" />
                  <span>Bifoga fullständig rapport som PDF</span>
                </label>

                <label className="mailBodyField">
                  <span>Kundsammanfattning</span>
                  <textarea value={mailPreview.bodyText} onChange={(event) => updateMailPreview({ bodyText: event.target.value })} />
                </label>

                {mailPreview.latestMail ? (
                  <div className="mailHistoryMini">
                    <strong>Senaste utskick</strong>
                    <span>{mailPreview.latestMail.sentAt ?? mailPreview.latestMail.createdAt} · {mailPreview.latestMail.status}</span>
                    <small>{mailPreview.latestMail.subject}</small>
                  </div>
                ) : null}

                <div className="mailModalActions">
                  <button className="buttonLink" disabled={mailSending} onClick={() => submitMail("draft")} type="button">
                    {mailSending ? "Sparar..." : "Spara utkast"}
                  </button>
                  <button className="primaryButton" disabled={mailSending} onClick={() => submitMail("send")} type="button">
                    {mailSending ? "Skickar..." : "Skicka mail"}
                  </button>
                </div>
              </>
            ) : null}
          </section>
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
