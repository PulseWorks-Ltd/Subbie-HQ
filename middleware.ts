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
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io",
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
// (SendGrid's inbound-parse webhook, Stripe, Railway Cron) that authenticate
// via their own signature/bearer-secret rather than a session cookie, and
// so never send a browser Origin/Referer header at all. CSRF protection
// exists to stop a browser from being tricked into firing a cookie-
// authenticated request; it has nothing to say about these.
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
  // Denies every listed browser feature outright — this app doesn't use
  // any of them from the browser.
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
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

  if (
    CSRF_PROTECTED_METHODS.has(request.method) &&
    pathname.startsWith("/api/") &&
    !isCsrfExempt(pathname) &&
    !isSameOriginRequest(request)
  ) {
    return applySecurityHeaders(NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }));
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

// Matches every route except static assets/images and the favicon, where
// these headers are unnecessary overhead — this still covers every page
// AND every /api/* route.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
