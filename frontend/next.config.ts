import type { NextConfig } from "next";

module.exports = {
  allowedDevOrigins: ['10.108.152.60']
}

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
