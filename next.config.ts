import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the legacy middleware file convention (Next.js 16 deprecates it
  // in favour of "proxy", but the middleware API still works when opted-in).
  experimental: {
    allowMiddlewareInSource: true,
  },
};

export default nextConfig;
