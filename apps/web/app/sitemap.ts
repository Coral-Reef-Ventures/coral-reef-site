import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/whitepaper/", "/get-involved/", "/privacy/"].map((path) => ({
    url: `https://coralreefventures.com${path}`,
  }));
}
