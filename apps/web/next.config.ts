import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@opus-nx/core", "@opus-nx/db", "@opus-nx/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@xyflow/react"],
  },
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

export default nextConfig;
