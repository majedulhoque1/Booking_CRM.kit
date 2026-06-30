// booking-crm-kit — notification sender (Supabase Edge Function, Deno)
//
// Drains public.notification_outbox (status = 'queued'), sends each message through a
// PLUGGABLE provider selected by NOTIFY_PROVIDER, then marks the row 'sent' or 'failed'.
// The schema is channel-agnostic — switching providers never touches SQL.
//
// SAFE BY DEFAULT: if the selected provider isn't configured, the queue is left untouched
// (no messages lost).
//
// ── Deploy ───────────────────────────────────────────────────────────────────
//   supabase functions deploy send-notifications
//
// ── Configure (pick ONE provider) ─────────────────────────────────────────────
//   supabase secrets set NOTIFY_PROVIDER=sms_bd  SMS_API_KEY=…  SMS_SENDER_ID=…
//   supabase secrets set NOTIFY_PROVIDER=twilio  TWILIO_ACCOUNT_SID=…  TWILIO_AUTH_TOKEN=…  TWILIO_FROM=…
//   supabase secrets set NOTIFY_PROVIDER=whatsapp  WHATSAPP_TOKEN=…  WHATSAPP_PHONE_ID=…
//   supabase secrets set NOTIFY_PROVIDER=webhook  NOTIFY_WEBHOOK_URL=…
//   # optional, used in lead-facing copy: NOTIFY_BRAND="Your Org"
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// ── Invoke ───────────────────────────────────────────────────────────────────
//   A Supabase Database Webhook on INSERT into notification_outbox, or a per-minute cron.
//   Each call drains all queued rows, so either works.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Provider = "sms_bd" | "twilio" | "whatsapp" | "webhook";

interface OutboxRow {
  id: string;
  event: "requested" | "confirmed" | "cancelled" | "rescheduled";
  recipient: "lead" | "staff";
  to_phone: string | null;
  payload: { name?: string; date?: string; time?: string; status?: string };
}

const env = (k: string) => Deno.env.get(k);
const BRAND = env("NOTIFY_BRAND") ?? "";

function fmtDate(d?: string): string {
  if (!d) return "";
  const dt = new Date(`${d}T00:00`);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const fmtTime = (t?: string) => (t ? t.slice(0, 5) : "");

// Channel-agnostic message text. Staff get an operational note; leads get a branded message.
function composeMessage(row: OutboxRow): string {
  const name = row.payload.name ?? "";
  const when = `${fmtDate(row.payload.date)} ${fmtTime(row.payload.time)}`.trim();
  const brand = BRAND ? `${BRAND}: ` : "";

  if (row.recipient === "staff") {
    if (row.event === "requested") return `New consultation request from ${name} for ${when}. Please review in the dashboard.`;
    if (row.event === "rescheduled") return `Consultation with ${name} has been rescheduled to ${when}.`;
    return `Confirmed: ${name}'s consultation on ${when}.`;
  }
  // lead
  if (row.event === "confirmed") return `${brand}your consultation is confirmed for ${when}. We look forward to seeing you.`;
  if (row.event === "rescheduled") return `${brand}your consultation has been rescheduled to ${when}. We look forward to seeing you.`;
  return `${brand}your consultation on ${when} has been cancelled. Please contact us to reschedule.`;
}

function provider(): Provider {
  return (env("NOTIFY_PROVIDER") as Provider) || "sms_bd";
}

// True if the selected provider has the secrets it needs.
function configured(p: Provider): boolean {
  switch (p) {
    case "sms_bd": return !!env("SMS_API_KEY");
    case "twilio": return !!(env("TWILIO_ACCOUNT_SID") && env("TWILIO_AUTH_TOKEN") && env("TWILIO_FROM"));
    case "whatsapp": return !!(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID"));
    case "webhook": return !!env("NOTIFY_WEBHOOK_URL");
  }
}

// Dispatch one message. Returns true on success. Add/adjust providers here only —
// the drain loop and the schema stay untouched.
async function send(p: Provider, to: string, message: string, row: OutboxRow): Promise<boolean> {
  try {
    if (p === "sms_bd") {
      // BulkSMSBD-style GET gateway (Bangladesh). Override SMS_API_URL for another GET gateway.
      const url = new URL(env("SMS_API_URL") ?? "https://bulksmsbd.net/api/smsapi");
      url.searchParams.set("api_key", env("SMS_API_KEY")!);
      url.searchParams.set("type", "text");
      url.searchParams.set("number", to);
      url.searchParams.set("senderid", env("SMS_SENDER_ID") ?? "");
      url.searchParams.set("message", message);
      return (await fetch(url.toString())).ok;
    }
    if (p === "twilio") {
      const sid = env("TWILIO_ACCOUNT_SID")!;
      const body = new URLSearchParams({ From: env("TWILIO_FROM")!, To: to, Body: message });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa(`${sid}:${env("TWILIO_AUTH_TOKEN")!}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      return res.ok;
    }
    if (p === "whatsapp") {
      // WhatsApp Cloud API. NOTE: business-initiated messages outside the 24h window require an
      // approved template; swap the `text` body for a `template` object if your use needs it.
      const res = await fetch(`https://graph.facebook.com/v19.0/${env("WHATSAPP_PHONE_ID")!}/messages`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${env("WHATSAPP_TOKEN")!}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }),
      });
      return res.ok;
    }
    // webhook — POST the full context; you wire actual delivery downstream.
    const res = await fetch(env("NOTIFY_WEBHOOK_URL")!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message, event: row.event, recipient: row.recipient, payload: row.payload }),
    });
    return res.ok;
  } catch (_e) {
    return false;
  }
}

Deno.serve(async () => {
  const p = provider();
  if (!configured(p)) {
    return new Response(JSON.stringify({ skipped: `provider '${p}' not configured` }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: rows, error } = await supabase
    .from("notification_outbox")
    .select("id, event, recipient, to_phone, payload")
    .eq("status", "queued")
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0, failed = 0;
  for (const row of (rows ?? []) as OutboxRow[]) {
    if (!row.to_phone) {
      await supabase.from("notification_outbox").update({ status: "failed" }).eq("id", row.id);
      failed++;
      continue;
    }
    const ok = await send(p, row.to_phone, composeMessage(row), row);
    await supabase.from("notification_outbox")
      .update({ status: ok ? "sent" : "failed", sent_at: ok ? new Date().toISOString() : null })
      .eq("id", row.id);
    ok ? sent++ : failed++;
  }

  return new Response(JSON.stringify({ provider: p, processed: (rows ?? []).length, sent, failed }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
