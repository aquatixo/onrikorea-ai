import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default Server Action body limit is 1MB -- too small for real work-item attachments.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
