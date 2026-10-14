import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/whitepaper/", "/eddy/", "/get-involved/", "/privacy/", "/terms/"].map((path) => ({
    url: `https://coralreefventures.com${path}`,
  }));
}
