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
  // Only needed when the webview loads from a different origin than the dev server
  // (Tauri mobile / remote dev, where TAURI_DEV_HOST is set). Applying it
  // unconditionally breaks any remote dev environment — Codespaces, a devcontainer,
  // a VM — because the browser would fetch every chunk from its own localhost.
  assetPrefix: !isProd && process.env.TAURI_DEV_HOST ? `http://${internalHost}:3000` : undefined,
};

export default nextConfig;
