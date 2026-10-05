import type { NextConfig } from "next";

// A static export: Amplify Hosting serves out/ as a WEB app. `trailingSlash` gives every page a directory, so a
// host with no rewrite rules still answers /privacy/.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@crv/brand"],
};

export default nextConfig;
