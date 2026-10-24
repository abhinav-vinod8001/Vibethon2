import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: {
    "/api/profile/resume": ["./assets/fonts/*.ttf"],
  },
};

export default nextConfig;
