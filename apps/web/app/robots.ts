import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/** The door is public; the admin views and the sign-in pages are not for a search index. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/signed-in/", "/signout/"] },
    sitemap: "https://coralreefventures.com/sitemap.xml",
  };
}
