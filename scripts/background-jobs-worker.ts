import "dotenv/config"

import { ensureBackgroundJobRuntimeReady } from "../src/lib/background-jobs"

async function main() {
  console.log("[background-jobs-worker] starting runtime")
  await ensureBackgroundJobRuntimeReady()
  console.log("[background-jobs-worker] runtime ready")
  await new Promise(() => undefined)
}

void main().catch((error) => {
  console.error("[background-jobs-worker] fatal error", error)
  process.exitCode = 1
})
