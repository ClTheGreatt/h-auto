import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=()" },
];

// Enforcing, production-only so dev's HMR WebSocket / Fast Refresh is never
// affected.
//
// 'unsafe-eval' is required by Zod v4's JIT schema compiler (Function()
// feature-probe with a graceful non-eval fallback) and decimal.js's
// global-object idiom (a recharts dependency). Both are trusted first-party
// dependencies; no dynamic evaluation of untrusted input occurs.
const CSP_VALUE = [
  "default-src 'self'",
  "img-src 'self' data: https://res.cloudinary.com https://placehold.co",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.54", "localhost", "127.0.0.1"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
  async headers() {
    const headers = [...securityHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Content-Security-Policy",
        value: CSP_VALUE,
      });
    }
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;