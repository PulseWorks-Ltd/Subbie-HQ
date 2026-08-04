import type { MetadataRoute } from "next";

// Keep in sync with app/sitemap.ts's BASE_URL.
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://subbie-hq.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/projects/",
        "/settings/",
        "/insurance/",
        "/main-contractors/",
        "/incoming-emails/",
        "/team/",
        "/invite/",
        "/platform-admin/",
        // Draft-only guide pages (outline content, DRAFT-banner) — not
        // ready for indexing even though the routes stay reachable
        // directly. Keep in sync with the exclusion in app/sitemap.ts.
        "/guides/payment-claims-construction-contracts-act",
        "/guides/site-instruction-vs-variation"
      ]
    },
    sitemap: `${BASE_URL}/sitemap.xml`
  };
}
