import assert from "node:assert/strict";
import {
  getMailProviderState,
  resendReplyToAddress,
  resendSenderAddress,
} from "./resend-provider";

const previous = {
  apiKey: process.env.RESEND_API_KEY,
  domain: process.env.RESEND_EMAIL_DOMAIN,
  from: process.env.RESEND_FROM_EMAIL,
  replyTo: process.env.RESEND_REPLY_TO_EMAIL,
  fetch: globalThis.fetch,
};

async function run() {
try {
  process.env.RESEND_API_KEY = "test_key";
  process.env.RESEND_EMAIL_DOMAIN = "rehnvvsmontage.se";
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.RESEND_REPLY_TO_EMAIL;

  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [{ name: "rehnvvsmontage.se", status: "verified" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const verified = await getMailProviderState();
  assert.equal(verified.configured, true);
  assert.equal(verified.ready, true);
  assert.equal(resendSenderAddress(), "Rehn VVS & Montage <husstatus@rehnvvsmontage.se>");
  assert.equal(resendReplyToAddress(), "info@rehnvvsmontage.se");

  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [{ name: "rehnvvsmontage.se", status: "not_started" }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  const pending = await getMailProviderState();
  assert.equal(pending.configured, true);
  assert.equal(pending.ready, false);
  assert.match(pending.message, /DNS-verifiering hos Loopia/);
} finally {
  if (previous.apiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previous.apiKey;
  if (previous.domain === undefined) delete process.env.RESEND_EMAIL_DOMAIN;
  else process.env.RESEND_EMAIL_DOMAIN = previous.domain;
  if (previous.from === undefined) delete process.env.RESEND_FROM_EMAIL;
  else process.env.RESEND_FROM_EMAIL = previous.from;
  if (previous.replyTo === undefined) delete process.env.RESEND_REPLY_TO_EMAIL;
  else process.env.RESEND_REPLY_TO_EMAIL = previous.replyTo;
  globalThis.fetch = previous.fetch;
}

console.log("resend-provider tests passed");
}

void run();
