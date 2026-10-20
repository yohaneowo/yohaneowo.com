import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker image runs .next/standalone with plain `node server.js`.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Dota hero renders are 1440px PNGs of 1–2 MB; the 绝活 pillars get them scaled down.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/apps/dota2/videos/dota_react/heroes/renders/**",
      },
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/apps/dota2/images/dota_react/heroes/**",
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
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
