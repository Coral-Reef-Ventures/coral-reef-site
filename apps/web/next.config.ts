import type { NextConfig } from "next";

// A static export: Amplify Hosting serves out/ as a WEB app. `trailingSlash` gives every page a directory, so a
// host with no rewrite rules still answers /privacy/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@crv/brand"],
  // Always defined, so a build without the admin stub folds the branch away and ships none of its sample data.
  env: { NEXT_PUBLIC_CRV_ADMIN_STUB: process.env.NEXT_PUBLIC_CRV_ADMIN_STUB ?? "" },
};

export default nextConfig;
