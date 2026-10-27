import type { MetadataRoute } from "next";

import { articlePath, publishedBy } from "../lib/articles.ts";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = publishedBy().map(articlePath);
  return ["/", "/articles/", ...articles, "/eddy/", "/get-involved/", "/privacy/", "/terms/"].map((path) => ({
    url: `https://coralreefventures.com${path}`,
  }));
}
