import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ============================================================
// Security headers — applied to every response (pages AND API routes;
// see the matcher below). This is the primary enforcement point;
// next.config.js's own `headers()` sets the identical values as a
// fallback in case a response somehow bypasses middleware.
// ============================================================

// Content-Security-Policy — start reasonably strict, but deliberately
// permissive on script-src/style-src ('unsafe-inline' 'unsafe-eval') for
// now, to avoid breaking existing inline scripts/styles without a
// nonce-based rollout first.
//
// TODO(security — tighten later): once every inline <script> is either
// removed or served with a per-request nonce, drop 'unsafe-inline' and
// 'unsafe-eval' from script-src. To do that: generate a random nonce
// per-request in this middleware (e.g. `crypto.randomUUID()`), forward it
// to the app via a request header (`request.headers.set("x-nonce", nonce)`
// then re-create the response from that mutated request), read it in the
// root layout to stamp every <script>/<style> tag with `nonce={nonce}`,
// and replace 'unsafe-inline' here with `'nonce-<value>'` (computed into
// the CSP string per-request instead of the static string below). Same
// idea for style-src's 'unsafe-inline' once inline style attributes are
// either removed or nonced/hashed.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  // fonts.googleapis.com/fonts.gstatic.com added here (2026-09) on top of
  // style-src/font-src already allowing them — the mobile PWA's service
  // worker (public/sw.js, scoped to /m) intercepts every fetch a
  // controlled page makes, including this cross-origin Material Symbols
  // stylesheet load, and re-issues it via its own fetch(event.request).
  // Once a service worker's own fetch() is in the loop, that request can
  // end up checked against connect-src instead of style-src/font-src,
  // which broke the icon font (and therefore every icon rendering as its
  // raw ligature text, e.g. "mic", "dark_mode") on /m specifically —
  // desktop has no service worker and was never affected. Belt-and-braces
  // alongside the sw.js fix (only intercept same-origin requests).
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests"
].join("; ");

// ============================================================
// CSRF / Origin protection for mutating API routes — turns what was
// previously only incidental protection (SameSite=Lax cookies + every
// mutating route expecting a JSON body a simple HTML <form> can't send)
// into an explicit control. A same-origin browser always sends an Origin
// header on state-changing requests (fetch/XHR — modern browsers include
// it even for same-origin, not just cross-origin), and falls back to
// Referer for the rare client that only sends that; a request with
// neither is rejected rather than let through, since a real same-origin
// fetch()/XHR call always sends at least one.
// ============================================================

const CSRF_PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Paths this check deliberately skips — genuine server-to-server callers
// that authenticate via their own signature/bearer-secret rather than a
// session cookie, and so never send a browser Origin/Referer header at all.
// CSRF protection exists to stop a browser from being tricked into firing a
// cookie-authenticated request; it has nothing to say about these. Prefix-
// based (not an exact-path list) so a new route added under one of these
// two directories is exempt automatically, without a middleware edit — but
// that convenience is exactly why nothing that relies on session-cookie
// auth may ever be added under either prefix; a route that needs both
// "no login" AND CSRF protection doesn't exist yet in this app, and should
// get its own dedicated prefix if it ever does, rather than reusing these.
//
// Every route this currently covers, confirmed by grepping app/api for
// "sendgrid"/"stripe" and listing app/api/webhooks + app/api/cron directly
// (2026-09-04) — re-confirm this list any time a new integration is added:
//   /api/webhooks/inbound-email        — SendGrid Inbound Parse (shared-secret
//                                         query param, see that route's own comment)
//   /api/webhooks/stripe               — Stripe (stripe-signature header, verified
//                                         via constructWebhookEvent)
//   /api/cron/reminders                — Railway Cron (Authorization: Bearer CRON_SECRET)
//   /api/cron/classify-inbound-emails  — Railway Cron (same bearer secret)
//   /api/cron/variation-schedule       — Railway Cron (same bearer secret)
//
// Both SendGrid and Stripe are exempted the exact same way: pathname is
// checked (and short-circuits the whole condition below) BEFORE Origin/
// Referer is ever read, so neither webhook's lack of those headers is ever
// evaluated in the first place — there's no code path in which one of the
// two is let through and the other isn't.
const CSRF_EXEMPT_PREFIXES = ["/api/webhooks/", "/api/cron/"];

function expectedOrigin(request: NextRequest): string {
  // Prefer the app's own configured URL (same env var auth.ts already
  // relies on for cookie/HTTPS detection) over deriving it from the
  // request's own Host header — a Host header is attacker-influenced
  // input in general, even though this app's actual deployment (behind
  // Railway's proxy) doesn't currently give an attacker room to spoof it.
  // Falls back to the request's own origin only if AUTH_URL/NEXTAUTH_URL
  // is somehow unset, so this can never hard-fail the whole app.
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to the request-derived origin below
    }
  }
  return request.nextUrl.origin;
}

function originFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function isSameOriginRequest(request: NextRequest): boolean {
  const sourceOrigin = request.headers.get("origin") ?? originFromReferer(request.headers.get("referer"));
  if (!sourceOrigin) return false;
  return sourceOrigin === expectedOrigin(request);
}

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  // HSTS — tells browsers to only ever contact this origin over HTTPS for
  // the next year, including subdomains. `preload` additionally opts in to
  // browsers' built-in HSTS preload lists — see the manual step below;
  // submitting to the preload list is a separate, one-time action outside
  // this codebase, and should only be done once you're certain every
  // subdomain in use is HTTPS-only.
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  // Stops a browser from trying to guess/override a response's declared
  // Content-Type (e.g. sniffing a text file as HTML/JS and executing it).
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Sends the full URL as a Referer header only for same-origin requests;
  // cross-origin requests only get the origin, never the full path/query
  // — relevant here since /invite/:token and /respond/:token URLs contain
  // sensitive tokens in the path that must never leak via a Referer header
  // to a third-party resource (e.g. Google Fonts).
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Camera/geolocation/payment/usb are denied outright — this app doesn't
  // use those APIs from the browser. Microphone is scoped to 'self' rather
  // than denied (2026-09 fix): the mobile diary's voice-note recorder
  // (components/updates/update-composer.tsx, navigator.mediaDevices.
  // getUserMedia({ audio: true })) genuinely needs it — denying it outright
  // broke that feature with "Couldn't access the microphone." "Take photo"
  // is unaffected either way since it uses <input capture> (the OS camera
  // app), not a live getUserMedia video stream.
  response.headers.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=(), usb=()");
  response.headers.set("Content-Security-Policy", CSP);
  return response;
}

// NOTE for whoever owns /invite/:token and /respond/:token: both are
// reachable by anyone with the URL and deliberately require no login —
// their entire security model rests on the token itself being long,
// random, and unguessable, and (where the action is sensitive/one-shot)
// single-use or short-lived with a real expiry. Headers here can't
// substitute for that. As things stand today:
//   - /respond/:token (lib/external-action.ts) generates a proper
//     crypto.randomBytes(32) token (256 bits) with a real expiresAt — good.
//   - /invite/:token (OrganisationInvite.token, prisma/schema.prisma) is a
//     plain @default(cuid()) — NOT purpose-built for unguessability the
//     way a random token is. It IS correctly single-use and time-limited
//     (app/api/invites/[token]/route.ts and .../accept/route.ts both
//     reject an already-accepted or expired invite), which meaningfully
//     narrows the window, but the token itself is still weaker than
//     /respond's. Worth revisiting (swap to the same
//     crypto.randomBytes(32)-style token, which would need a migration)
//     — flagged here rather than changed, since that's a schema/business-
//     logic change outside this task's scope.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (CSRF_PROTECTED_METHODS.has(request.method) && pathname.startsWith("/api/") && !isCsrfExempt(pathname)) {
    if (!isSameOriginRequest(request)) {
      // Logged server-side (not just returned to the caller) specifically
      // so a genuine integration that unexpectedly needs exempting shows up
      // immediately in Railway's logs, instead of silently failing and
      // being misdiagnosed later — include enough to tell "a real
      // server-to-server caller hit a path that isn't on the exempt list
      // yet" apart from "a browser really was cross-site" without needing
      // to reproduce it.
      console.warn("CSRF check rejected request:", {
        method: request.method,
        pathname,
        origin: request.headers.get("origin"),
        referer: request.headers.get("referer")
      });
      return applySecurityHeaders(NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }));
    }
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

// Matches every route except static assets/images/favicon, AND except
// /api/webhooks/* + /api/cron/* — added after establishing that the CSRF
// logic above was never actually the cause of SendGrid Inbound Parse
// failing (its pathname-based exemption already short-circuits before
// Origin/Referer is read — verified for both /api/webhooks/inbound-email
// and /api/webhooks/stripe with identical results). What actually changed
// for SendGrid: this middleware.ts file didn't exist at all before the
// first security-hardening pass, and Next.js Edge Middleware sitting in
// front of a route is a known source of request-body issues specifically
// for large multipart/form-data POSTs (which SendGrid Inbound Parse sends,
// carrying whole emails + attachments) — Stripe's much smaller raw
// JSON/text webhook body was never at risk the same way, which is exactly
// the asymmetry reported (Stripe fine, SendGrid broken) and why the
// in-function isCsrfExempt() check alone wasn't a full fix: it stopped the
// CSRF rejection, but didn't stop middleware from running in front of the
// request at all. Excluding these two prefixes from the matcher means
// middleware — this whole file — never executes for them, which is
// strictly stronger than exempting them inside it: there is no longer any
// Edge-runtime code sitting between SendGrid/Stripe/Cron and their route
// handlers to interfere with body forwarding. Security headers (CSP/HSTS/
// etc.) are meaningless to a non-browser caller anyway, so nothing of
// value is lost by skipping this file for them. The CSRF exemption logic
// above is kept as defense-in-depth in case this matcher is ever loosened
// without the code-level check being noticed.
export const config = {
  // Trailing slash on the last two deliberately (api/webhooks/, api/cron/,
  // not just api/webhooks) — this is a substring-prefix lookahead, not a
  // path-segment match, so without it a hypothetical future route like
  // /api/webhooks-legacy/... would also unintentionally bypass this file.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/cron/).*)"]
};
