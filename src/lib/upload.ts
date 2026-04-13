import { createHash } from "crypto"
import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Jimp, loadFont, measureText, measureTextHeight } from "jimp"
import { SANS_8_WHITE, SANS_16_WHITE, SANS_32_WHITE, SANS_64_WHITE, SANS_128_WHITE } from "jimp/fonts"

import { getServerSiteSettings } from "@/lib/site-settings"
import { resolveUploadBaseUrl } from "@/lib/upload-path"
import { normalizeUploadProvider } from "@/lib/upload-provider"
import { buildUploadStoragePath } from "@/lib/upload-path"
import { getUploadMimeType } from "@/lib/upload-rules"

export interface SavedUploadFile {
  fileName: string
  storagePath: string
  urlPath: string
  fileExt: string
  fileSize: number
  mimeType: string
  fileHash: string
}

export interface PreparedUploadFile {
  buffer: Buffer
  fileHash: string
  detectedMime: string
}

type UploadSettings = Awaited<ReturnType<typeof getServerSiteSettings>>
interface WatermarkImageLike {
  bitmap: {
    width: number
    height: number
    data: Buffer
  }
  scan(callback: (x: number, y: number, idx: number) => void): unknown
}
type ImageWatermarkConfig = Pick<
  UploadSettings,
  "imageWatermarkEnabled"
  | "imageWatermarkText"
  | "imageWatermarkPosition"
  | "imageWatermarkOpacity"
  | "imageWatermarkFontSize"
  | "imageWatermarkMargin"
  | "imageWatermarkColor"
>
type WatermarkUploadSettings = ImageWatermarkConfig & Pick<
  UploadSettings,
  never
>

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
])
const WATERMARK_SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png"])
const WATERMARK_APPLICABLE_FOLDERS = new Set(["posts", "comments", "post-covers"])
const WATERMARK_FONT_PATHS = {
  8: SANS_8_WHITE,
  16: SANS_16_WHITE,
  32: SANS_32_WHITE,
  64: SANS_64_WHITE,
  128: SANS_128_WHITE,
} as const
const PINGFANG_WATERMARK_FONT_PATH = path.join(process.cwd(), "public", "apps", "fonts", "PingFang_24_BLACK.fnt")
const watermarkFontCache = new Map<string, Promise<Awaited<ReturnType<typeof loadFont>>>>()

/**
 * 通过文件头魔数（magic bytes）检测真实 MIME 类型。
 * 不信任客户端传入的 file.type，防止伪造 Content-Type 绕过类型限制。
 */
function detectMimeTypeFromBytes(bytes: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif"
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp"
  // AVIF / HEIF: ftyp box at offset 4 with brand avif/heic/hei
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
    if (brand.startsWith("avif") || brand.startsWith("avis")) return "image/avif"
  }
  return null
}

function detectSvgMimeType(buffer: Buffer): string | null {
  const text = buffer.subarray(0, Math.min(buffer.length, 4096)).toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()

  if (!text) {
    return null
  }

  if (/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype\s+svg[\s\S]*?>\s*)*<svg\b/i.test(text)) {
    return "image/svg+xml"
  }

  return null
}

function normalizeHexColorToRgb(hexColor: string) {
  const normalized = hexColor.trim().replace(/^#/, "")
  const expanded = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized

  const red = Number.parseInt(expanded.slice(0, 2), 16)
  const green = Number.parseInt(expanded.slice(2, 4), 16)
  const blue = Number.parseInt(expanded.slice(4, 6), 16)

  return {
    red: Number.isFinite(red) ? red : 255,
    green: Number.isFinite(green) ? green : 255,
    blue: Number.isFinite(blue) ? blue : 255,
  }
}

function shouldApplyImageWatermark(params: {
  detectedMime: string
  folder?: string
  settings?: ImageWatermarkConfig
}) {
  return Boolean(
    params.settings?.imageWatermarkEnabled
    && params.settings.imageWatermarkText.trim()
    && params.folder
    && WATERMARK_APPLICABLE_FOLDERS.has(params.folder)
    && WATERMARK_SUPPORTED_MIME_TYPES.has(params.detectedMime),
  )
}

function mapMimeTypeToJimpFormat(mimeType: string): "image/jpeg" | "image/png" {
  switch (mimeType) {
    case "image/jpeg":
      return "image/jpeg"
    case "image/png":
    default:
      return "image/png"
  }
}

function resolveWatermarkFontSize(fontSize: number) {
  const availableFontSizes = Object.keys(WATERMARK_FONT_PATHS).map((item) => Number(item)).sort((left, right) => left - right)
  let resolvedSize = availableFontSizes[0]

  for (const candidate of availableFontSizes) {
    resolvedSize = candidate
    if (fontSize <= candidate) {
      break
    }
  }

  return resolvedSize as keyof typeof WATERMARK_FONT_PATHS
}

function containsNonAsciiText(value: string) {
  return /[^\x00-\x7F]/.test(value)
}

async function getWatermarkFont(text: string, fontSize: number) {
  if (containsNonAsciiText(text)) {
    const cacheKey = `pingfang:24`
    if (!watermarkFontCache.has(cacheKey)) {
      watermarkFontCache.set(cacheKey, loadFont(PINGFANG_WATERMARK_FONT_PATH))
    }

    return {
      font: await watermarkFontCache.get(cacheKey)!,
      scaleRatio: Math.max(0.5, fontSize / 24),
    }
  }

  const resolvedFontSize = resolveWatermarkFontSize(fontSize)
  const cacheKey = `default:${resolvedFontSize}`

  if (!watermarkFontCache.has(cacheKey)) {
    watermarkFontCache.set(cacheKey, loadFont(WATERMARK_FONT_PATHS[resolvedFontSize]))
  }

  return {
    font: await watermarkFontCache.get(cacheKey)!,
    scaleRatio: 1,
  }
}

function recolorTextWatermarkImage(image: WatermarkImageLike, hexColor: string, opacityPercent: number) {
  const { red, green, blue } = normalizeHexColorToRgb(hexColor)
  const opacityRatio = Math.min(1, Math.max(0, opacityPercent / 100))

  image.scan((x: number, y: number, idx: number) => {
    void x
    void y
    const alpha = image.bitmap.data[idx + 3]
    if (alpha <= 0) {
      return
    }

    image.bitmap.data[idx] = red
    image.bitmap.data[idx + 1] = green
    image.bitmap.data[idx + 2] = blue
    image.bitmap.data[idx + 3] = Math.round(alpha * opacityRatio)
  })
}

function resolveWatermarkPlacement(options: {
  width: number
  height: number
  overlayWidth: number
  overlayHeight: number
  position: UploadSettings["imageWatermarkPosition"]
  margin: number
}) {
  const { width, height, overlayWidth, overlayHeight, position, margin } = options

  switch (position) {
    case "TOP_LEFT":
      return { x: margin, y: margin }
    case "TOP_RIGHT":
      return { x: Math.max(0, width - overlayWidth - margin), y: margin }
    case "BOTTOM_LEFT":
      return { x: margin, y: Math.max(0, height - overlayHeight - margin) }
    case "CENTER":
      return { x: Math.max(0, Math.round((width - overlayWidth) / 2)), y: Math.max(0, Math.round((height - overlayHeight) / 2)) }
    case "BOTTOM_RIGHT":
    default:
      return { x: Math.max(0, width - overlayWidth - margin), y: Math.max(0, height - overlayHeight - margin) }
  }
}

async function createTextWatermarkImage(baseImage: WatermarkImageLike, settings: ImageWatermarkConfig) {
  const watermarkText = settings.imageWatermarkText.trim()
  if (!watermarkText) {
    return null
  }

  const margin = Math.max(0, settings.imageWatermarkMargin)
  const availableWidth = Math.max(24, baseImage.bitmap.width - margin * 2)
  const { font, scaleRatio } = await getWatermarkFont(watermarkText, settings.imageWatermarkFontSize)
  const unscaledAvailableWidth = Math.max(24, Math.floor(availableWidth / scaleRatio))
  const textWidth = Math.min(unscaledAvailableWidth, Math.max(1, measureText(font, watermarkText)))
  const textHeight = Math.max(1, measureTextHeight(font, watermarkText, textWidth))
  const textImage = new Jimp({ width: textWidth, height: textHeight, color: 0x00000000 })

  textImage.print({
    font,
    x: 0,
    y: 0,
    text: watermarkText,
    maxWidth: textWidth,
    maxHeight: textHeight,
  })
  recolorTextWatermarkImage(textImage, settings.imageWatermarkColor, settings.imageWatermarkOpacity)

  if (Math.abs(scaleRatio - 1) > 0.001) {
    textImage.scale(scaleRatio)
  }

  return textImage
}

async function buildWatermarkOverlay(baseImage: WatermarkImageLike, fullSettings: WatermarkUploadSettings, settings: ImageWatermarkConfig) {
  void fullSettings
  return createTextWatermarkImage(baseImage, settings)
}

async function applyImageWatermarkToBuffer(params: {
  buffer: Buffer
  detectedMime: string
  folder?: string
  settings?: WatermarkUploadSettings
}) {
  if (!shouldApplyImageWatermark(params)) {
    return params.buffer
  }

  try {
    const image = await Jimp.read(params.buffer)
    const overlay = await buildWatermarkOverlay(image, params.settings!, params.settings!)
    if (!overlay) {
      return params.buffer
    }

    const coordinates = resolveWatermarkPlacement({
      width: image.bitmap.width,
      height: image.bitmap.height,
      overlayWidth: overlay.bitmap.width,
      overlayHeight: overlay.bitmap.height,
      position: params.settings!.imageWatermarkPosition,
      margin: params.settings!.imageWatermarkMargin,
    })
    image.composite(overlay, coordinates.x, coordinates.y)

    return await image.getBuffer(mapMimeTypeToJimpFormat(params.detectedMime))
  } catch (error) {
    console.warn("[upload] failed to apply image watermark, fallback to original image", error)
    return params.buffer
  }
}

function resolveGenericMimeType(file: File) {
  const browserMimeType = file.type?.trim().toLowerCase()

  if (browserMimeType && browserMimeType !== "application/octet-stream") {
    return browserMimeType
  }

  return getUploadMimeType(file.name)
}

/**
 * 单次读取整文件，复用同一块 Buffer 完成哈希计算、类型检测和后续写盘。
 */
export async function prepareUploadedFile(file: File, options?: {
  folder?: string
  settings?: WatermarkUploadSettings
}): Promise<PreparedUploadFile> {
  const sourceBuffer = Buffer.from(await file.arrayBuffer())
  const detectedMime = detectMimeTypeFromBytes(sourceBuffer.subarray(0, 12)) ?? detectSvgMimeType(sourceBuffer)

  if (!detectedMime || !IMAGE_MIME_TYPES.has(detectedMime)) {
    throw new Error("仅支持上传常见图片格式文件")
  }

  const buffer = await applyImageWatermarkToBuffer({
    buffer: sourceBuffer,
    detectedMime,
    folder: options?.folder,
    settings: options?.settings,
  })

  return {
    buffer,
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    detectedMime,
  }
}

/**
 * 以哈希值命名文件，保证同内容不重复写盘。
 * 文件名格式：{folder}-{hash8}.{ext}
 */
async function saveToLocal(
  file: File,
  preparedFile: PreparedUploadFile,
  folder: string,
  localPath: string,
  baseUrl: string | null | undefined,
): Promise<SavedUploadFile> {
  const ext = path.extname(file.name) || ".bin"
  const shortHash = preparedFile.fileHash.slice(0, 16)
  const fileName = `${folder}-${shortHash}${ext}`
  const uploadRoot = buildUploadStoragePath(localPath, folder)

  await mkdir(uploadRoot, { recursive: true })
  await writeFile(path.join(uploadRoot, fileName), preparedFile.buffer)

  const resolvedBaseUrl = resolveUploadBaseUrl(baseUrl)
  const urlPath = `${resolvedBaseUrl}/${folder}/${fileName}`.replace(/\\/g, "/")

  return {
    fileName,
    storagePath: path.join(uploadRoot, fileName),
    urlPath,
    fileExt: ext,
    fileSize: preparedFile.buffer.byteLength,
    mimeType: preparedFile.detectedMime,
    fileHash: preparedFile.fileHash,
  }
}

export async function prepareBinaryUploadedFile(file: File): Promise<PreparedUploadFile> {
  const buffer = Buffer.from(await file.arrayBuffer())

  return {
    buffer,
    fileHash: createHash("sha256").update(buffer).digest("hex"),
    detectedMime: resolveGenericMimeType(file),
  }
}

function resolveS3ObjectKey(folder: string, fileName: string) {
  return `${folder}/${fileName}`.replace(/^\/+|\/+$/g, "")
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, "")
}

function resolveS3PublicUrl(settings: UploadSettings, objectKey: string) {
  const normalizedObjectKey = objectKey.replace(/^\/+/, "")
  if (settings.uploadBaseUrl?.trim()) {
    return `${trimTrailingSlash(settings.uploadBaseUrl.trim())}/${normalizedObjectKey}`
  }

  const endpoint = settings.uploadOssEndpoint?.trim()
  const bucket = settings.uploadOssBucket?.trim()
  if (!endpoint || !bucket) {
    throw new Error("对象存储访问地址无法生成，请补充资源访问基础 URL")
  }

  const parsedEndpoint = new URL(endpoint)
  if (settings.uploadS3ForcePathStyle) {
    return `${trimTrailingSlash(parsedEndpoint.toString())}/${bucket}/${normalizedObjectKey}`
  }

  parsedEndpoint.hostname = `${bucket}.${parsedEndpoint.hostname}`
  parsedEndpoint.pathname = `/${normalizedObjectKey}`
  parsedEndpoint.search = ""
  parsedEndpoint.hash = ""
  return parsedEndpoint.toString()
}

function validateOssSettings(settings: UploadSettings) {
  if (!settings.uploadOssBucket || !settings.uploadOssRegion || !settings.uploadOssEndpoint) {
    throw new Error("对象存储配置不完整，请先在后台上传设置中填写 Bucket、Region 和 Endpoint")
  }

  if (!settings.uploadS3AccessKeyId || !settings.uploadS3SecretAccessKey) {
    throw new Error("对象存储密钥不完整，请先在后台上传设置中填写 Access Key ID 和 Secret Access Key")
  }
}

function createS3Client(settings: UploadSettings) {
  validateOssSettings(settings)

  return new S3Client({
    region: settings.uploadOssRegion ?? "auto",
    endpoint: settings.uploadOssEndpoint ?? undefined,
    forcePathStyle: settings.uploadS3ForcePathStyle,
    credentials: {
      accessKeyId: settings.uploadS3AccessKeyId ?? "",
      secretAccessKey: settings.uploadS3SecretAccessKey ?? "",
    },
  })
}

async function saveToOss(
  file: File,
  preparedFile: PreparedUploadFile,
  folder: string,
  settings: UploadSettings,
): Promise<SavedUploadFile> {
  const ext = path.extname(file.name) || ".bin"
  const shortHash = preparedFile.fileHash.slice(0, 16)
  const fileName = `${folder}-${shortHash}${ext}`
  const objectKey = resolveS3ObjectKey(folder, fileName)
  const client = createS3Client(settings)

  await client.send(new PutObjectCommand({
    Bucket: settings.uploadOssBucket ?? undefined,
    Key: objectKey,
    Body: preparedFile.buffer,
    ContentType: preparedFile.detectedMime,
    CacheControl: "public, max-age=31536000, immutable",
  }))

  return {
    fileName,
    storagePath: `s3://${settings.uploadOssBucket}/${objectKey}`,
    urlPath: resolveS3PublicUrl(settings, objectKey),
    fileExt: ext,
    fileSize: preparedFile.buffer.byteLength,
    mimeType: preparedFile.detectedMime,
    fileHash: preparedFile.fileHash,
  }
}

export async function saveUploadedFile(file: File, preparedFile: PreparedUploadFile, folder = "avatars"): Promise<SavedUploadFile> {
  const settings = await getServerSiteSettings()
  const uploadProvider = normalizeUploadProvider(settings.uploadProvider)

  if (uploadProvider === "local") {
    return saveToLocal(file, preparedFile, folder, settings.uploadLocalPath || "uploads", settings.uploadBaseUrl)
  }

  if (uploadProvider === "s3") {
    return saveToOss(file, preparedFile, folder, settings)
  }

  throw new Error(`不支持的上传策略：${settings.uploadProvider}`)
}

function parseS3StoragePath(storagePath: string) {
  const matched = storagePath.match(/^s3:\/\/([^/]+)\/(.+)$/i)

  if (!matched) {
    throw new Error("对象存储路径不合法")
  }

  return {
    bucket: matched[1],
    key: matched[2],
  }
}

async function readStoredUploadFile(params: {
  storagePath: string
  urlPath?: string | null
}) {
  if (params.storagePath.startsWith("s3://")) {
    const settings = await getServerSiteSettings()
    const { bucket, key } = parseS3StoragePath(params.storagePath)
    const client = createS3Client(settings)
    const result = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    if (!result.Body) {
      throw new Error("附件内容不存在")
    }

    const bytes = await result.Body.transformToByteArray()
    return Buffer.from(bytes)
  }

  return readFile(params.storagePath)
}

function buildContentDisposition(fileName: string) {
  const sanitizedFileName = fileName.replace(/["\\\r\n]+/g, "_")
  const asciiFallbackFileName = sanitizedFileName
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    || "download"
  const encodedFileName = encodeURIComponent(fileName).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${asciiFallbackFileName}"; filename*=UTF-8''${encodedFileName}`
}

export async function createDownloadResponseFromStoredUpload(params: {
  storagePath: string
  mimeType?: string | null
  fileSize?: number | null
  fileName: string
}) {
  const fileBuffer = await readStoredUploadFile({
    storagePath: params.storagePath,
  })

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": params.mimeType?.trim() || "application/octet-stream",
      "Content-Length": String(params.fileSize ?? fileBuffer.byteLength),
      "Content-Disposition": buildContentDisposition(params.fileName),
      "Cache-Control": "private, no-store",
    },
  })
}
