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

function createRedisClient() {
  const client = new Redis(readRedisUrl(), {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableAutoPipelining: true,
  })

  client.on("error", (error) => {
    console.error("[redis] unexpected error", error)
  })

  return client
}

export function getRedis() {
  const client = globalForRedis.redis ?? createRedisClient()

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = client
  }

  return client
}

export function createRedisConnection() {
  const sharedClient = globalForRedis.redis

  if (sharedClient) {
    return sharedClient.duplicate()
  }

  return createRedisClient()
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
