import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs .next/standalone with plain `node server.js`.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/trakt", destination: "/moviehub", permanent: false },
      { source: "/trakt/:path*", destination: "/moviehub", permanent: false },
      // CoinHub became TradeHub (2026-10-19); old links keep working.
      { source: "/coinhub", destination: "/tradehub", permanent: true },
      { source: "/:lang(zh|en)/coinhub", destination: "/:lang/tradehub", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
