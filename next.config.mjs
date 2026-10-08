/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent the page from being embedded in iframes (clickjacking)
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // X-XSS-Protection is deprecated and can introduce vulnerabilities in older browsers.
  // Modern CSP provides superior protection.
  // { key: "X-XSS-Protection", value: "1; mode=block" },
  // Restrict Referer header to origin only on cross-origin requests
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down browser features not used by this app
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  },
  // Force HTTPS for 1 year (only active once served over HTTPS)
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // Content Security Policy — primary XSS defense
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // NOTE: 'unsafe-inline' and 'unsafe-eval' are required for Next.js 16 runtime
      // (styled-jsx, fast refresh, etc.). Removing them will break the app.
      // For a stricter policy, implement CSP nonces via middleware.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://analytics.knowyourgov.us",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://theunitedstates.io https://bioguide.congress.gov https://*.oyez.org",
      "connect-src 'self' https://api.bigdatacloud.net https://ipapi.co https://api.usaspending.gov https://analytics.knowyourgov.us",
      "font-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  output: "standalone",
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "theunitedstates.io",
      },
      {
        protocol: "https",
        hostname: "bioguide.congress.gov",
      },
      {
        protocol: "https",
        hostname: "*.oyez.org",
      },
      {
        protocol: "https",
        hostname: "oyez.org",
      },
    ],
  },
};

export default nextConfig;
