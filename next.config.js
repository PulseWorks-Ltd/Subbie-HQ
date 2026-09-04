import { withSentryConfig } from "@sentry/nextjs";

// Kept in sync with middleware.ts's own copy of these same values —
// middleware is the primary enforcement point (it also covers /api/*
// routes); this headers() config is a fallback for any response that
// somehow bypasses middleware. See middleware.ts for the full reasoning
// behind each header/directive.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  {
    key: "Content-Security-Policy",
    value: [
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
    ].join("; ")
  }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removes the "X-Powered-By: Next.js" response header (avoids
  // advertising the exact framework/version to a would-be attacker) — the
  // one header from this task that can't be reliably stripped from
  // middleware, since Next's server adds it after middleware runs.
  poweredByHeader: false,
  // Explicit, not just relying on the default — client-side source maps
  // must never be publicly served in production. (Server-side source maps
  // for Sentry are handled separately below: generated at build time,
  // uploaded to Sentry, then deleted from the build output.)
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    },
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js", "@napi-rs/canvas", "sharp"]
  },
  // This project has no ESLint config (no .eslintrc, no eslint dependency)
  // — without this, `next build`'s lint step launches an interactive
  // "how would you like to configure ESLint?" setup wizard, which hangs
  // indefinitely waiting for stdin in any non-interactive build (found
  // when a build silently stalled after "Linting and checking validity of
  // types..." with no error). There's no lint config to skip, so this
  // changes nothing about what actually runs — it just makes `next build`
  // deterministic instead of dependent on how a given shell's stdin
  // happens to behave.
  eslint: {
    ignoreDuringBuilds: true
  }
};

// For all available options, see:
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
export default withSentryConfig(nextConfig, {
  org: "pulseworks-limited",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Explicit, not just relying on the default — source maps are uploaded
  // to Sentry for readable stack traces, then deleted from the actual
  // build output so they're never publicly servable from production.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true
    }
  }
});
