import type { MetadataRoute } from "next";

// Real production domain is the hyphenated subbie-hq.com — not subbiehq.com
// (that was a wrong placeholder that shipped live and got indexed with the
// wrong domain in every <loc>). No NEXT_PUBLIC_APP_URL is set anywhere in
// this codebase (checked .env.example, .env.staging, README), so this
// fallback is what actually serves in production today.
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://subbie-hq.com";

// /guides/payment-claims-construction-contracts-act is deliberately
// excluded — still outline-only, marked with a DRAFT banner, not ready for
// indexing. Keep excluded until it's actually written; see app/robots.ts
// for the matching explicit Disallow.
const MARKETING_PATHS = [
  "/",
  "/pricing",
  "/features/contract-review",
  "/features/variations",
  "/features/project-diary",
  "/features/dayworks",
  "/features/approvals-automation",
  "/features/quality-assurance",
  "/features/insurance",
  "/features/team-permissions",
  "/features/scope-programme",
  "/industries/scaffolding",
  "/industries/painting",
  "/industries/masonry",
  "/industries/residential-builders",
  "/compare/spreadsheets-and-paper",
  "/guides/late-or-non-compliant-claims",
  "/guides/site-instruction-vs-variation"
];

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date()
  }));
}
