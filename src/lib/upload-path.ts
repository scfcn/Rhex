const UPLOAD_PATH_FALLBACK = "uploads"

function hasUnsafeUploadPathSegments(value: string) {
  return value
    .split("/")
    .some((segment) => segment === "." || segment === "..")
}

export function normalizeUploadLocalPath(value?: string | null, fallback = UPLOAD_PATH_FALLBACK) {
  const trimmedValue = value?.trim().replace(/\\/g, "/") ?? ""
  if (!trimmedValue) {
    return fallback
  }

  const normalizedValue = trimmedValue
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/")

  if (!normalizedValue) {
    return fallback
  }

  if (hasUnsafeUploadPathSegments(normalizedValue)) {
    throw new Error("本地上传目录不允许包含 . 或 .. 路径段")
  }

  return normalizedValue
}
