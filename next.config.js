import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
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
