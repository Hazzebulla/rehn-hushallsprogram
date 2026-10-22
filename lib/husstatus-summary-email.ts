export type MailTemplateVariant = "short" | "standard" | "detailed";

export type SummaryEmailInput = {
  customerName: string;
  recipient: string;
  propertyLabel: string;
  reportUrl?: string;
  reportPublished: boolean;
  reportVersion?: number | null;
  healthScore?: number | null;
  riskLevel?: string | null;
  riskIndex?: number | null;
  controlGrade?: number | null;
  counts?: {
    urgent?: number;
    recommended?: number;
    watch?: number;
    passed?: number;
  } | null;
  actions?: Array<{
    component?: string;
    action?: string;
    reason?: string;
    priority?: string;
    recommendedTime?: string;
    costCents?: number;
    status?: string;
  }>;
  componentAssessments?: Array<{
    component?: string;
    conditionScore?: number;
    riskLevel?: string;
    actionNeed?: string;
    recommendedTime?: string;
    forecastPeriod?: string;
    forecastConfidence?: string;
    costCents?: number;
    reasonsNegative?: string[];
  }>;
};

export type SummaryEmailDraft = {
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  reportUrl?: string;
  reportPublished: boolean;
  reportVersion?: number | null;
  template: MailTemplateVariant;
  providerConfigured: boolean;
  providerMessage?: string;
  summary: SummaryEmailSnapshot;
};

export type SummaryEmailSnapshot = {
  healthScore: number | null;
  healthLabel: string;
  riskLevel: string;
  riskIndex: number | null;
  controlGrade: number | null;
  urgent: number;
  recommended: number;
  watch: number;
  passed: number;
};

function statusLabel(score?: number | null) {
  if (score === undefined || score === null) return "Ej bedömd";
  if (score >= 80) return "Bra";
  if (score >= 60) return "Bör följas upp";
  if (score >= 40) return "Åtgärder rekommenderas";
  return "Förhöjd risk";
}

function money(costCents?: number | null) {
  if (!costCents) return "";
  return `${Math.round(costCents / 100).toLocaleString("sv-SE")} kr`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paragraphs(bodyText: string) {
  return bodyText
    .split(/\n{2,}/)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function bodyWithoutStandaloneReportUrl(bodyText: string, reportUrl?: string) {
  if (!reportUrl) return bodyText;
  return bodyText
    .split("\n")
    .filter((line) => line.trim() !== reportUrl)
    .join("\n");
}

export function renderHusstatusSummaryEmailHtml(args: {
  bodyText: string;
  propertyLabel: string;
  reportUrl?: string;
  summary?: SummaryEmailSnapshot;
}) {
  const visibleBodyText = bodyWithoutStandaloneReportUrl(args.bodyText, args.reportUrl);
  const title = `Din Husstatus - ${args.propertyLabel}`;
  const preheader = `Din fastighetsöversikt för ${args.propertyLabel} från Rehn VVS & Montage.`;
  const button = args.reportUrl
    ? `<a class="report-button" href="${escapeHtml(args.reportUrl)}" style="display:inline-block;background:#58c8d5;color:#031012;text-decoration:none;font-size:16px;font-weight:800;line-height:20px;padding:15px 22px;border-radius:4px;text-align:center">Öppna din fullständiga Husstatus</a>`
    : `<strong style="color:#8a6200">Rapporten är inte publicerad ännu.</strong>`;
  const summary = args.summary;
  const metrics = summary ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px">
      <tr>
        <td class="metric-cell" width="33.33%" valign="top" style="padding:0 5px 0 0"><div style="border:1px solid #d5e4e5;padding:14px;background:#f6faf9"><span style="display:block;color:#527073;font-size:11px;font-weight:700;text-transform:uppercase">Husstatus</span><strong style="display:block;color:#082326;font-size:24px;margin-top:5px">${summary.healthScore ?? "–"}${summary.healthScore === null ? "" : "/100"}</strong><span style="color:#527073;font-size:12px">${escapeHtml(summary.healthLabel)}</span></div></td>
        <td class="metric-cell" width="33.33%" valign="top" style="padding:0 3px"><div style="border:1px solid #d5e4e5;padding:14px;background:#f6faf9"><span style="display:block;color:#527073;font-size:11px;font-weight:700;text-transform:uppercase">Risknivå</span><strong style="display:block;color:#082326;font-size:24px;margin-top:5px">${escapeHtml(summary.riskLevel)}</strong><span style="color:#527073;font-size:12px">${summary.riskIndex === null ? "Ej beräknad" : `${summary.riskIndex} % riskindex`}</span></div></td>
        <td class="metric-cell" width="33.33%" valign="top" style="padding:0 0 0 5px"><div style="border:1px solid #d5e4e5;padding:14px;background:#f6faf9"><span style="display:block;color:#527073;font-size:11px;font-weight:700;text-transform:uppercase">Kontrollgrad</span><strong style="display:block;color:#082326;font-size:24px;margin-top:5px">${summary.controlGrade === null ? "–" : `${summary.controlGrade} %`}</strong><span style="color:#527073;font-size:12px">Verifierat underlag</span></div></td>
      </tr>
    </table>` : "";

  return `<!doctype html><html lang="sv" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>@media only screen and (max-width:600px){.email-shell{padding:12px 6px!important}.email-content,.email-header{padding:22px 18px!important}.metric-cell{display:block!important;width:100%!important;padding:0 0 8px!important}.report-button{display:block!important}}</style></head><body style="margin:0;background:#edf3f2;color:#183335;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table lang="sv" dir="ltr" role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#edf3f2"><tr><td class="email-shell" align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;border-collapse:collapse;background:#ffffff;border:1px solid #c8dcdd"><tr><td class="email-header" style="background:#061617;border-bottom:4px solid #58c8d5;padding:26px 28px"><strong style="color:#58c8d5;font-size:15px;letter-spacing:1.2px">RVM HUSSTATUS</strong><h1 style="margin:12px 0 5px;color:#ffffff;font-size:30px;line-height:1.1">Din fastighetsöversikt</h1><p style="color:#a9c5c5;margin:0;font-size:15px">${escapeHtml(args.propertyLabel)}</p></td></tr><tr><td class="email-content" style="padding:26px 28px;line-height:1.6">${metrics}<div style="font-size:15px;color:#183335">${paragraphs(visibleBodyText)}</div><div style="margin:26px 0 12px">${button}</div><div style="border-top:1px solid #d5e4e5;margin-top:28px;padding-top:18px;color:#527073;font-size:12px;line-height:1.5"><strong style="color:#183335">Rehn VVS &amp; Montage</strong><br>Detta utskick hör till den Husstatus som genomförts på fastigheten. Svara på mailet om du har frågor.</div></td></tr></table></td></tr></table></body></html>`;
}

function actionLines(input: SummaryEmailInput, limit: number) {
  return (input.actions ?? []).slice(0, limit).map((action, index) => {
    const cost = money(action.costCents);
    return [
      `${index + 1}. ${action.component || action.action || "Åtgärd"}`,
      action.reason || action.action || "Bör följas upp.",
      `Rekommendation: ${action.recommendedTime || "Tid ej satt"}.${cost ? ` Uppskattad kostnad: ${cost}.` : ""}`,
    ].join("\n");
  });
}

function watchLines(input: SummaryEmailInput, limit: number) {
  return (input.componentAssessments ?? [])
    .filter((item) => /Bevaka|Kontroll|Planera|ny bedömning/i.test(`${item.actionNeed ?? ""} ${item.recommendedTime ?? ""}`))
    .slice(0, limit)
    .map((item) => {
      const reason = item.reasonsNegative?.[0] ?? "Bör följas upp vid kommande kontroll.";
      return `${item.component}: ${reason} Rekommendation: ${item.recommendedTime || item.forecastPeriod || "nästa kontroll"}.`;
    });
}

function costSummary(input: SummaryEmailInput) {
  const knownCosts = (input.actions ?? [])
    .map((action) => action.costCents ?? 0)
    .filter((cost) => cost > 0);
  if (!knownCosts.length) return "Kända rekommenderade kostnader: pris ej fastställt.";
  const sum = knownCosts.reduce((total, cost) => total + cost, 0);
  const low = Math.round(sum * 0.85);
  const high = Math.round(sum * 1.15);
  return `Kända rekommenderade kostnader: cirka ${money(low)}-${money(high).replace(" kr", "")} kr.`;
}

export function buildHusstatusSummaryEmail(
  input: SummaryEmailInput,
  template: MailTemplateVariant = "standard",
): SummaryEmailDraft {
  const customerFirstName = input.customerName.split(/\s+/)[0] || input.customerName || "kund";
  const healthLine = input.healthScore !== null && input.healthScore !== undefined
    ? `Husstatus: ${input.healthScore}/100 - ${statusLabel(input.healthScore)}`
    : "Husstatus: Ej bedömd";
  const riskLine = `Risknivå: ${input.riskLevel || "Ej bedömd"}${input.riskIndex !== undefined && input.riskIndex !== null ? ` (${input.riskIndex} %)` : ""}`;
  const controlLine = input.controlGrade !== undefined && input.controlGrade !== null
    ? `Kontrollgrad: ${input.controlGrade} %`
    : "Kontrollgrad: Ej beräknad";
  const counts = input.counts ?? {};
  const urgentText = counts.urgent ? `${counts.urgent} akuta brister identifierades.` : "Inga akuta brister identifierades vid kontrollen.";
  const actions = actionLines(input, template === "detailed" ? 5 : 3);
  const watches = watchLines(input, template === "detailed" ? 5 : 3);

  const lines = [
    `Hej ${customerFirstName},`,
    `Tack för att vi fick genomföra Husstatus på ${input.propertyLabel}.`,
    ["Övergripande bedömning:", healthLine, riskLine, controlLine].join("\n"),
    ["Vid kontrollen identifierades:", `- ${urgentText}`, `- ${counts.recommended ?? 0} rekommenderade åtgärder`, `- ${counts.watch ?? 0} punkter som bör följas upp`, `- ${counts.passed ?? 0} kontroller utan anmärkning`].join("\n"),
    actions.length ? ["Viktigast att känna till:", ...actions].join("\n\n") : "Viktigast att känna till:\nInga större åtgärder är registrerade i sammanfattningen.",
    template !== "short" && watches.length ? ["Bevakningspunkter:", ...watches].join("\n") : "",
    template === "detailed" ? costSummary(input) : template === "standard" ? costSummary(input) : "",
    input.reportUrl
      ? ["Den fullständiga rapporten med bilder, kontrollpunkter och långsiktig plan finns här:", input.reportUrl].join("\n")
      : "Den fullständiga rapporten är inte publicerad med kundlänk ännu.",
    "Med vänlig hälsning\nRehn VVS & Montage",
  ].filter(Boolean);

  const bodyText = lines.join("\n\n");
  const subject = `Din Husstatus – ${input.propertyLabel}`;
  const summary: SummaryEmailSnapshot = {
    healthScore: input.healthScore ?? null,
    healthLabel: statusLabel(input.healthScore),
    riskLevel: input.riskLevel || "Ej bedömd",
    riskIndex: input.riskIndex ?? null,
    controlGrade: input.controlGrade ?? null,
    urgent: counts.urgent ?? 0,
    recommended: counts.recommended ?? 0,
    watch: counts.watch ?? 0,
    passed: counts.passed ?? 0,
  };
  const bodyHtml = renderHusstatusSummaryEmailHtml({
    bodyText,
    propertyLabel: input.propertyLabel,
    reportUrl: input.reportUrl,
    summary,
  });

  return {
    recipient: input.recipient,
    subject,
    bodyText,
    bodyHtml,
    reportUrl: input.reportUrl,
    reportPublished: input.reportPublished,
    reportVersion: input.reportVersion,
    template,
    providerConfigured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_EMAIL_DOMAIN),
    summary,
  };
}
