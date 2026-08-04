import type { MetadataRoute } from "next";

// No canonical production domain is configured anywhere in this codebase
// yet (checked .env.example, .env.staging, README) — set
// NEXT_PUBLIC_APP_URL once the real domain is decided. Falls back to a
// placeholder so this still builds/runs correctly in the meantime.
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://subbiehq.com";

const MARKETING_PATHS = [
  "/",
  "/pricing",
  "/features/contract-review",
  "/features/variations",
  "/features/dayworks",
  "/industries/scaffolding",
  "/industries/painting",
  "/compare/spreadsheets-and-paper",
  "/guides/payment-claims-construction-contracts-act",
  "/guides/site-instruction-vs-variation"
];

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_PATHS.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date()
  }));
}
