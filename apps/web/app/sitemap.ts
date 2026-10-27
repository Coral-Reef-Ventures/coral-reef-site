import type { MetadataRoute } from "next";

import { ARTICLES, articlePath } from "../lib/articles.ts";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = ARTICLES.map(articlePath);
  return ["/", "/articles/", ...articles, "/eddy/", "/get-involved/", "/privacy/", "/terms/"].map((path) => ({
    url: `https://coralreefventures.com${path}`,
  }));
}
