import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const internalHost = process.env.TAURI_DEV_HOST || "localhost";

const nextConfig: NextConfig = {
  // Tauri loads a static frontend; no Node server in production.
  output: "export",
  images: {
    unoptimized: true,
  },
  // Helps the Tauri asset protocol resolve nested routes.
  trailingSlash: true,
  // Required so assets resolve correctly during `tauri dev`.
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
};

export default nextConfig;
