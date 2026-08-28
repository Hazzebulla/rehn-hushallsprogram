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

export function renderHusstatusSummaryEmailHtml(args: { bodyText: string; propertyLabel: string; reportUrl?: string }) {
  const button = args.reportUrl
    ? `<a href="${escapeHtml(args.reportUrl)}" style="display:inline-block;background:#48d6e6;color:#031012;text-decoration:none;font-weight:800;padding:12px 18px;border-radius:4px">Öppna fullständig Husstatus</a>`
    : `<strong style="color:#f0c445">Rapporten är inte publicerad ännu.</strong>`;
  return `<!doctype html><html><body style="margin:0;background:#061012;color:#eaf5f3;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="border:1px solid #28505a;background:#102126;padding:20px"><strong style="color:#48d6e6;letter-spacing:.08em">RVM HUSSTATUS</strong><h1 style="margin:12px 0 4px;color:white;font-size:28px">Din Husstatus</h1><p style="color:#9fbcbc;margin:0">${escapeHtml(args.propertyLabel)}</p></div><div style="border:1px solid #28505a;border-top:0;background:#081618;padding:20px;line-height:1.55">${paragraphs(args.bodyText)}<p>${button}</p><p style="color:#9fbcbc;font-size:12px">Rehn VVS & Montage</p></div></div></body></html>`;
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
  const bodyHtml = renderHusstatusSummaryEmailHtml({ bodyText, propertyLabel: input.propertyLabel, reportUrl: input.reportUrl });

  return {
    recipient: input.recipient,
    subject,
    bodyText,
    bodyHtml,
    reportUrl: input.reportUrl,
    reportPublished: input.reportPublished,
    reportVersion: input.reportVersion,
    template,
    providerConfigured: Boolean(process.env.RESEND_API_KEY),
  };
}
