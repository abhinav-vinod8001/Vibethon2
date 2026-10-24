import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16.3's adapter build omits the whole-server trace that standalone
  // packaging expects. Vercel packages its own output; Docker still needs ours.
  // https://github.com/vercel/next.js/issues/96646
  output: process.env.VERCEL === "1" ? undefined : "standalone",
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/profile/resume": ["./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
