import type { NextConfig } from "next";

/**
 * GitHub Pages project sites are served from /<repo>/, so the export has to be
 * built with a matching basePath + assetPrefix. Set NEXT_PUBLIC_BASE_PATH in the
 * deploy workflow; leave it unset for `npm run dev` / `npm start`.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  basePath,
  assetPrefix: basePath,
  // Static export has no next/image optimizer server.
  images: { unoptimized: true },
};

export default nextConfig;
