import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@opus-nx/core", "@opus-nx/db", "@opus-nx/shared"],
  experimental: {
    optimizePackageImports: ["lucide-react", "@xyflow/react"],
  },
  serverExternalPackages: ["@anthropic-ai/sdk"],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],
};

export default nextConfig;
