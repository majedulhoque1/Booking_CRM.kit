// Server-only analytics collector (Cloudflare Worker / Nitro). No client/TanStack imports.
// Genericized from the reference site: no hardcoded Supabase URL, and the day-boundary
// timezone is configurable via ANALYTICS_TZ (set it to the same IANA value as the
// contract's site_settings.timezone). Inserts via the service role only.

const BOT_RE = /(bot|crawler|spider|crawl|slurp|mediapartners|facebookexternalhit|preview|monitor|curl|wget|python-requests|headless)/i;
const MOBILE_RE = /(iphone|android.*mobile|windows phone|ipod)/i;
const TABLET_RE = /(ipad|android(?!.*mobile)|tablet)/i;

export function normalizePath(input: string | undefined): string {
  if (!input) return "/";
  let p = input.split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

export function parseReferrerHost(referrer: string | undefined | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).host || null;
  } catch {
    return null;
  }
}

export function deviceFromUA(ua: string): "mobile" | "tablet" | "desktop" {
  if (TABLET_RE.test(ua)) return "tablet";
  if (MOBILE_RE.test(ua)) return "mobile";
  return "desktop";
}

export function isBot(ua: string): boolean {
  if (!ua || ua.trim() === "") return true;
  return BOT_RE.test(ua);
}

// Day boundary in the configured timezone (default UTC). Keep this aligned with the
// contract's site_settings.timezone so visitor_hash rotation matches the dashboard days.
export function tzDateString(now: Date = new Date(), tz = "UTC"): string {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export async function visitorHash(
  salt: string,
  ip: string,
  ua: string,
  day: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${salt}|${ip}|${ua}|${day}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface CollectEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ANALYTICS_SALT?: string;
  ANALYTICS_TZ?: string; // IANA tz; match site_settings.timezone. Default UTC.
}

// Resolve config from the handler-provided env first, then process.env.
// Under Nitro's Cloudflare preset the worker entry is Nitro's own module, so our
// handler's `env` argument is NOT the Cloudflare `env`; the secrets surface on
// process.env instead. Checking both makes the collector runtime-agnostic.
function resolveEnv(passed?: CollectEnv): CollectEnv {
  const out: CollectEnv = { ...(passed ?? {}) };
  try {
    const pe = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env;
    if (pe) {
      out.SUPABASE_URL ??= pe.SUPABASE_URL;
      out.SUPABASE_SERVICE_ROLE_KEY ??= pe.SUPABASE_SERVICE_ROLE_KEY;
      out.ANALYTICS_SALT ??= pe.ANALYTICS_SALT;
      out.ANALYTICS_TZ ??= pe.ANALYTICS_TZ;
    }
  } catch {
    // `process` may be undefined in some runtimes — ignore and use passed env.
  }
  return out;
}

// Reads request headers + body, builds the row, inserts via Supabase REST.
// Always resolves; never throws to the caller.
export async function handleCollect(request: Request, env: CollectEnv): Promise<Response> {
  try {
    const ua = request.headers.get("user-agent") ?? "";
    if (isBot(ua)) return new Response(null, { status: 204 });

    let body: { path?: string; referrer?: string } = {};
    try {
      body = await request.json();
    } catch {
      return new Response(null, { status: 204 });
    }

    const cfg = resolveEnv(env);
    const supabaseUrl = cfg.SUPABASE_URL;
    const serviceKey = cfg.SUPABASE_SERVICE_ROLE_KEY;
    const salt = cfg.ANALYTICS_SALT ?? "";
    const tz = cfg.ANALYTICS_TZ ?? "UTC";
    if (!supabaseUrl || !serviceKey) {
      // not configured → no-op (keeps SSR/preview from erroring)
      return new Response(null, { status: 204 });
    }

    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "0.0.0.0";
    const country = request.headers.get("cf-ipcountry") ?? null;

    const row = {
      path: normalizePath(body.path),
      referrer_host: parseReferrerHost(body.referrer),
      visitor_hash: await visitorHash(salt, ip, ua, tzDateString(new Date(), tz)),
      country: country && country !== "XX" ? country : null,
      device: deviceFromUA(ua),
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!insertRes.ok) {
      console.log(
        `[collect] insert failed ${insertRes.status}: ${(await insertRes.text()).slice(0, 200)}`,
      );
    }

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
