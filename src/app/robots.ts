import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/decks", "/billing", "/settings", "/api"],
    },
    sitemap: "https://slidequill.com/sitemap.xml",
  };
}
