import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/questions/export': ['./src/assets/fonts/*.ttf'],
  },
};

export default nextConfig;
