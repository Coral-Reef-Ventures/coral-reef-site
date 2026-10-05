import type { MetadataRoute } from "next";

export const dynamic = "force-static";

// The admin views and the sign-in pages are not for search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: ["/admin/", "/signed-in/", "/signout/"] } };
}
