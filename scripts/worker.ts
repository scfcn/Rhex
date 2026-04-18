import "dotenv/config"

import { ensureBackgroundJobRuntimeReady } from "../src/lib/background-jobs"
import { acquireRedisLease, type RedisLease } from "../src/lib/redis-lease"
import { createRedisKey, hasRedisUrl } from "../src/lib/redis"

const WORKER_SINGLETON_LEASE_KEY = createRedisKey("worker", "singleton")
const WORKER_SINGLETON_LEASE_TTL_MS = 30_000
const WORKER_SINGLETON_LEASE_RENEW_INTERVAL_MS = 10_000

let singletonLease: RedisLease | null = null
let leaseRenewTimer: ReturnType<typeof setInterval> | null = null
let shuttingDown = false

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function releaseSingletonLease() {
  if (leaseRenewTimer) {
    clearInterval(leaseRenewTimer)
    leaseRenewTimer = null
  }

  if (singletonLease) {
    try {
      await singletonLease.release()
    } catch {}
    singletonLease = null
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  console.log(`[worker] received ${signal}, shutting down...`)
  await releaseSingletonLease()
  process.exit(0)
}

function startLeaseRenewLoop() {
  if (!singletonLease || leaseRenewTimer) {
    return
  }

  leaseRenewTimer = setInterval(async () => {
    if (!singletonLease) {
      return
    }

    try {
      const renewed = await singletonLease.renew(WORKER_SINGLETON_LEASE_TTL_MS)
      if (!renewed) {
        console.error("[worker] singleton lease lost, exiting...")
        await releaseSingletonLease()
        process.exit(1)
      }
    } catch (error) {
      console.error("[worker] singleton lease renew failed", error)
    }
  }, WORKER_SINGLETON_LEASE_RENEW_INTERVAL_MS)
}

async function acquireWorkerSingletonLease() {
  const startedAt = Date.now()

  while (Date.now() - startedAt < WORKER_SINGLETON_LEASE_TTL_MS + 2_000) {
    const lease = await acquireRedisLease({
      key: WORKER_SINGLETON_LEASE_KEY,
      ttlMs: WORKER_SINGLETON_LEASE_TTL_MS,
    })

    if (lease) {
      return lease
    }

    await sleep(1_000)
  }

  return null
}

async function main() {
  if (hasRedisUrl()) {
    singletonLease = await acquireWorkerSingletonLease()

    if (!singletonLease) {
      console.error("[worker] another worker instance is already running")
      process.exitCode = 1
      return
    }

    startLeaseRenewLoop()
    console.log("[worker] singleton lease acquired")
  }

  console.log("[worker] starting background jobs runtime")
  await ensureBackgroundJobRuntimeReady()
  console.log("[worker] background jobs runtime ready")
}

process.on("SIGINT", () => { void shutdown("SIGINT") })
process.on("SIGTERM", () => { void shutdown("SIGTERM") })
process.on("exit", () => {
  if (leaseRenewTimer) {
    clearInterval(leaseRenewTimer)
  }
})

void main().catch((error) => {
  console.error("[worker] fatal error", error)
  void releaseSingletonLease()
  process.exitCode = 1
})
