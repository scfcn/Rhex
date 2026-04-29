import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const isProductionBuild = process.env.NODE_ENV === "production"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps:false,
  typescript: {
    ignoreBuildErrors: isProductionBuild,
  },
  serverExternalPackages: ["@napi-rs/canvas", "ioredis", "nodemailer"],
  experimental: {
    serverSourceMaps:false,
    proxyClientMaxBodySize: "64mb",
    turbopackMemoryLimit: 1024 * 1024 * 1024,
  },
  turbopack: {
    root: projectRoot,
  }
}

export default nextConfig
