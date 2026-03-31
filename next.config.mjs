import path from "path"
import { fileURLToPath } from "url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps:false,
  experimental: {
    webpackBuildWorker: true,
    serverSourceMaps:false,
  },
  turbopack: {
    root: projectRoot,
  }
}

export default nextConfig
