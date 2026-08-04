import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://subbiehq.com";

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
        "/platform-admin/"
      ]
    },
    sitemap: `${BASE_URL}/sitemap.xml`
  };
}
