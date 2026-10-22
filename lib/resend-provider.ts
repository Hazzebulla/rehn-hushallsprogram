type ResendDomain = {
  name?: string;
  status?: string;
};

type ResendDomainsResponse = {
  data?: ResendDomain[];
  message?: string;
};

export type MailProviderState = {
  configured: boolean;
  ready: boolean;
  domain?: string;
  message: string;
};

function normalizeDomain(value?: string) {
  return value?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
}

export function resendSenderAddress() {
  if (process.env.RESEND_FROM_EMAIL?.trim()) return process.env.RESEND_FROM_EMAIL.trim();
  const domain = normalizeDomain(process.env.RESEND_EMAIL_DOMAIN);
  return domain
    ? `Rehn VVS & Montage <husstatus@${domain}>`
    : "Rehn VVS & Montage <onboarding@resend.dev>";
}

export function resendReplyToAddress() {
  return process.env.RESEND_REPLY_TO_EMAIL?.trim() || "info@rehnvvsmontage.se";
}

export async function getMailProviderState(): Promise<MailProviderState> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const domain = normalizeDomain(process.env.RESEND_EMAIL_DOMAIN);

  if (!apiKey) {
    return {
      configured: false,
      ready: false,
      domain: domain || undefined,
      message: "Mailtjänsten saknar API-nyckel. Utkast kan sparas, men mail kan inte skickas ännu.",
    };
  }

  if (!domain) {
    return {
      configured: true,
      ready: false,
      message: "Mailtjänsten är ansluten, men avsändardomänen saknas i konfigurationen.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as ResendDomainsResponse;
    if (!response.ok) {
      return {
        configured: true,
        ready: false,
        domain,
        message: payload.message || "Mailtjänstens domänstatus kunde inte kontrolleras.",
      };
    }

    const matchingDomains = (payload.data ?? []).filter((item) => normalizeDomain(item.name) === domain);
    if (matchingDomains.some((item) => item.status?.toLowerCase() === "verified")) {
      return {
        configured: true,
        ready: true,
        domain,
        message: `Mailtjänsten är klar. Utskick görs från husstatus@${domain}.`,
      };
    }

    if (matchingDomains.length) {
      return {
        configured: true,
        ready: false,
        domain,
        message: `Maildomänen ${domain} väntar på DNS-verifiering hos Loopia. Utkast kan sparas under tiden.`,
      };
    }

    return {
      configured: true,
      ready: false,
      domain,
      message: `Maildomänen ${domain} finns inte i Resend ännu.`,
    };
  } catch {
    return {
      configured: true,
      ready: false,
      domain,
      message: "Mailtjänstens status kunde inte kontrolleras just nu. Försök igen om en stund.",
    };
  }
}
