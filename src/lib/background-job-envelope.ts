import { createHash, randomUUID } from "node:crypto"

import {
  getBackgroundJobMaxAttemptsFallback,
  getBackgroundJobRetryBaseMs,
  getBackgroundJobRetryMaxMs,
} from "@/lib/background-job-config"
import { normalizePositiveInteger } from "@/lib/shared/normalizers"
import { parseBoundedInteger } from "@/lib/shared/number-parsers"
import type {
  BackgroundJobDeadLetterRecord,
  BackgroundJobEnvelope,
  BackgroundJobName,
} from "@/lib/background-jobs"

export class BackgroundJobPermanentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BackgroundJobPermanentError"
  }
}

function createLegacyBackgroundJobId(serializedJob: string) {
  return `legacy:${createHash("sha1").update(serializedJob).digest("hex").slice(0, 24)}`
}

function createBackgroundJobId() {
  return randomUUID()
}

export function serializeBackgroundJobError(error: unknown) {
  const record = typeof error === "object" && error !== null
    ? error as { name?: unknown; message?: unknown }
    : null

  return error instanceof Error
    ? {
        name: error.name,
        message: error.message,
      }
    : record
      ? {
          name: typeof record.name === "string" && record.name.trim()
            ? record.name
            : "Error",
          message: typeof record.message === "string" && record.message.trim()
            ? record.message
            : String(error),
        }
    : {
        name: "Error",
        message: String(error),
      }
}

export function resolveBackgroundJobMaxAttempts(value?: number) {
  return parseBoundedInteger(value, getBackgroundJobMaxAttemptsFallback(), { min: 1, max: 20 })
}

export function resolveBackgroundJobRetryDelayMs(attempt: number) {
  const baseDelayMs = getBackgroundJobRetryBaseMs()
  const maxDelayMs = getBackgroundJobRetryMaxMs()
  const retryDelayMs = baseDelayMs * Math.max(1, 2 ** Math.max(0, attempt - 1))

  return Math.min(maxDelayMs, retryDelayMs)
}

export function normalizeBackgroundJobEnvelope<Name extends BackgroundJobName>(
  job: Omit<BackgroundJobEnvelope<Name>, "id" | "attempt" | "maxAttempts">
    & Partial<Pick<BackgroundJobEnvelope<Name>, "id" | "attempt" | "maxAttempts">>,
): BackgroundJobEnvelope<Name> {
  return {
    ...job,
    id: typeof job.id === "string" && job.id.trim() ? job.id.trim() : createBackgroundJobId(),
    attempt: normalizePositiveInteger(job.attempt, 1),
    maxAttempts: resolveBackgroundJobMaxAttempts(job.maxAttempts),
  }
}

export function parseBackgroundJobEnvelopeString(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<BackgroundJobEnvelope>

    if (!parsed || typeof parsed !== "object" || typeof parsed.name !== "string" || typeof parsed.enqueuedAt !== "string" || !("payload" in parsed)) {
      return null
    }

    return normalizeBackgroundJobEnvelope({
      id: typeof parsed.id === "string" && parsed.id.trim()
        ? parsed.id.trim()
        : createLegacyBackgroundJobId(value),
      name: parsed.name,
      payload: parsed.payload as BackgroundJobEnvelope["payload"],
      enqueuedAt: parsed.enqueuedAt,
      attempt: parsed.attempt,
      maxAttempts: parsed.maxAttempts,
      availableAt: typeof parsed.availableAt === "string" ? parsed.availableAt : undefined,
      idempotencyKey: typeof parsed.idempotencyKey === "string" && parsed.idempotencyKey.trim()
        ? parsed.idempotencyKey.trim()
        : undefined,
    })
  } catch {
    return null
  }
}

export function createBackgroundJobLogMetadata(job: BackgroundJobEnvelope, extra?: Record<string, unknown>) {
  return {
    jobId: job.id,
    jobName: job.name,
    enqueuedAt: job.enqueuedAt,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt ?? null,
    idempotencyKey: job.idempotencyKey ?? null,
    payload: job.payload,
    ...(extra ?? {}),
  }
}

export function createBackgroundJobRetryEnvelope<Name extends BackgroundJobName>(job: BackgroundJobEnvelope<Name>) {
  if (job.attempt >= job.maxAttempts) {
    return null
  }

  return {
    ...job,
    attempt: job.attempt + 1,
    availableAt: new Date(Date.now() + resolveBackgroundJobRetryDelayMs(job.attempt)).toISOString(),
  } satisfies BackgroundJobEnvelope<Name>
}

export function createBackgroundJobDeadLetterRecord(
  job: BackgroundJobEnvelope,
  error: unknown,
  retryable: boolean,
): BackgroundJobDeadLetterRecord {
  return {
    job,
    failedAt: new Date().toISOString(),
    retryable,
    error: serializeBackgroundJobError(error),
  }
}

export function normalizeBackgroundJobThrownError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  const serialized = serializeBackgroundJobError(error)
  const normalized = new Error(serialized.message)
  normalized.name = serialized.name
  return normalized
}

export function isBackgroundJobRetryableError(error: unknown) {
  return error instanceof Error && !(error instanceof BackgroundJobPermanentError)
}