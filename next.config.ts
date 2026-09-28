import type { NextConfig } from "next";

// Next.js injects inline hydration scripts and several UI libraries (Base UI, Tailwind)
// set inline styles for positioning -- without nonce infrastructure, 'unsafe-inline' is
// the pragmatic baseline here. 'unsafe-eval' is dev-only (webpack/Turbopack's dev-time
// module eval needs it); production never gets it.
const isDev = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  // Dev-only: Turbopack/webpack's HMR client connects over ws:// to the same host --
  // 'self' alone doesn't cover the scheme change from http(s) to ws(s).
  `connect-src 'self'${isDev ? " ws://localhost:* wss://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    // Default Server Action body limit is 1MB -- too small for real work-item attachments.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
