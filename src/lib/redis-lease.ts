import { randomUUID } from "crypto"

import { getRedis } from "@/lib/redis"

const RELEASE_LEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`

export interface RedisLease {
  key: string
  token: string
  release: () => Promise<boolean>
}

export async function acquireRedisLease(options: {
  key: string
  ttlMs: number
}): Promise<RedisLease | null> {
  const redis = getRedis()
  const key = options.key
  const token = randomUUID()
  const ttlMs = Math.max(1, Math.floor(options.ttlMs))
  const result = await redis.set(key, token, "PX", ttlMs, "NX")

  if (result !== "OK") {
    return null
  }

  return {
    key,
    token,
    release: async () => {
      const releaseResult = await redis.eval(RELEASE_LEASE_SCRIPT, 1, key, token)
      return Number(releaseResult) === 1
    },
  }
}
