import "dotenv/config"

import { startRssWorkerLoop } from "../src/lib/rss-harvest"

const controller = new AbortController()

function shutdown(signal: string) {
  console.log(`[rss-worker] received ${signal}, shutting down...`)
  controller.abort()
}

process.on("SIGINT", () => shutdown("SIGINT"))
process.on("SIGTERM", () => shutdown("SIGTERM"))

async function main() {
  console.log("[rss-worker] starting worker loop")
  await startRssWorkerLoop({
    workerId: process.env.RSS_WORKER_ID?.trim() || undefined,
    signal: controller.signal,
  })
  console.log("[rss-worker] stopped")
}

void main().catch((error) => {
  console.error("[rss-worker] fatal error", error)
  process.exitCode = 1
})
