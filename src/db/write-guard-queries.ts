import { prisma } from "@/db/client"

export function purgeExpiredRequestControls(now: Date) {
  return prisma.requestControl.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  })
}

export function createRequestControl(data: {
  scope: string
  identity: string
  kind: string
  fingerprint: string | null
  expiresAt: Date
}) {
  return prisma.requestControl.create({
    data,
  })
}

export function deleteExpiredRequestControlsForKey(input: {
  scope: string
  identity: string
  kind: string
  fingerprint: string | null
  now: Date
}) {
  return prisma.requestControl.deleteMany({
    where: {
      scope: input.scope,
      identity: input.identity,
      kind: input.kind,
      fingerprint: input.fingerprint,
      expiresAt: {
        lte: input.now,
      },
    },
  })
}

export function deleteRequestControlById(id: string) {
  return prisma.requestControl.deleteMany({
    where: { id },
  })
}
