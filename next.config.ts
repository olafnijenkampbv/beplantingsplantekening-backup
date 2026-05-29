import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // better-sqlite3 is a native Node.js module — must never be bundled for the browser
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;

