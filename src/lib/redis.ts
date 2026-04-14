import Redis from "ioredis"

type GlobalRedisState = {
  redis?: Redis
}

const globalForRedis = globalThis as typeof globalThis & GlobalRedisState

export function hasRedisUrl() {
  return Boolean(process.env.REDIS_URL?.trim())
}

function readRedisUrl() {
  const url = process.env.REDIS_URL?.trim()

  if (!url) {
    throw new Error("缺少 REDIS_URL 环境变量，无法连接 Redis")
  }

  return url
}

function detectRedisProcessRole() {
  const entrypoint = process.argv[1]?.replace(/\\/g, "/").toLowerCase() ?? ""

  if (entrypoint.includes("background-jobs-worker")) {
    return "jobs-worker"
  }

  if (entrypoint.includes("/worker.ts")) {
    return "worker"
  }

  if (entrypoint.includes("rss-worker")) {
    return "rss-worker"
  }

  if (entrypoint.includes("next")) {
    return "web"
  }

  return process.env.NODE_ENV === "production" ? "app" : "dev"
}

function buildRedisConnectionName(role: string) {
  const prefix = process.env.REDIS_CLIENT_NAME_PREFIX?.trim() || "rhex"
  const processRole = detectRedisProcessRole()

  return [prefix, processRole, String(process.pid), role].join(":")
}

function createRedisClient(role = "shared") {
  const client = new Redis(readRedisUrl(), {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
    connectionName: buildRedisConnectionName(role),
  })

  client.on("error", (error) => {
    console.error("[redis] unexpected error", error)
  })

  return client
}

export function getRedis() {
  if (!globalForRedis.redis) {
    globalForRedis.redis = createRedisClient("shared")
  }

  return globalForRedis.redis
}

export function createRedisConnection(role = "duplicate") {
  return getRedis().duplicate({
    connectionName: buildRedisConnectionName(role),
  })
}

export async function connectRedisClient(client: Redis) {
  if (client.status === "ready") {
    return client
  }

  try {
    await client.connect()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!message.includes("already connecting") && !message.includes("already connected")) {
      throw error
    }
  }

  return client
}

export function createRedisKey(...parts: Array<string | number>) {
  const prefix = process.env.REDIS_KEY_PREFIX?.trim() || "rhex"

  return [prefix, ...parts.map((part) => String(part))].join(":")
}
