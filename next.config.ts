import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Allow logo/signature image uploads (default limit is 1 MB).
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
