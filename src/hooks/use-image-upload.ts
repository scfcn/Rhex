import { useCallback, useState } from "react"

const IMAGE_UPLOAD_MAX_CONCURRENCY = 1

export type UploadFileStatus = "queued" | "uploading" | "success" | "error"

export type UploadFileResult = {
  name: string
  status: UploadFileStatus
  urlPath?: string
  errorMessage?: string
}

type UseImageUploadOptions = {
  uploadFolder?: string
  onInsert: (markdown: string) => void
}

type UseImageUploadResult = {
  uploading: boolean
  uploadResults: UploadFileResult[]
  uploadImageFiles: (files: File[]) => Promise<number>
  clearUploadResults: () => void
}

export function useImageUpload({ uploadFolder = "posts", onInsert }: UseImageUploadOptions): UseImageUploadResult {
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadFileResult[]>([])

  const clearUploadResults = useCallback(() => {
    setUploadResults([])
  }, [])

  const uploadImageFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return 0
    }

    setUploading(true)
    const initialResults: UploadFileResult[] = files.map((file) => ({
      name: file.name,
      status: "queued",
    }))
    setUploadResults(initialResults)

    const updateUploadResult = (index: number, next: Partial<UploadFileResult> & Pick<UploadFileResult, "status">) => {
      setUploadResults((prev) => prev.map((item, i) => (
        i === index
          ? {
            ...item,
            ...next,
          }
          : item
      )))
    }

    const uploadOne = async (file: File, index: number): Promise<string | null> => {
      updateUploadResult(index, {
        status: "uploading",
        errorMessage: undefined,
        urlPath: undefined,
      })

      const formData = new FormData()
      formData.append("file", file)
      formData.append("folder", uploadFolder)

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })
        const result = await response.json()

        if (!response.ok) {
          const errorMessage = result.message ?? `${file.name} 上传失败`
          updateUploadResult(index, { status: "error", errorMessage })
          return null
        }

        const urlPath: string = result.data?.urlPath ?? ""
        updateUploadResult(index, {
          status: "success",
          urlPath,
          errorMessage: undefined,
        })
        return urlPath
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : `${file.name} 上传失败`
        updateUploadResult(index, {
          status: "error",
          errorMessage,
          urlPath: undefined,
        })
        return null
      }
    }

    try {
      const urlPaths = Array<string | null>(files.length).fill(null)
      let nextIndex = 0
      const workerCount = Math.min(IMAGE_UPLOAD_MAX_CONCURRENCY, files.length)

      const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < files.length) {
          const currentIndex = nextIndex
          nextIndex += 1
          urlPaths[currentIndex] = await uploadOne(files[currentIndex], currentIndex)
        }
      })

      await Promise.all(workers)

      const markdownLines = files
        .map((file, index) => urlPaths[index] !== null ? `![${file.name}](${urlPaths[index]})` : null)
        .filter((line): line is string => line !== null)

      if (markdownLines.length > 0) {
        onInsert(markdownLines.join("\n\n"))
      }

      return markdownLines.length
    } finally {
      setUploading(false)
    }
  }, [onInsert, uploadFolder])

  return {
    uploading,
    uploadResults,
    uploadImageFiles,
    clearUploadResults,
  }
}
