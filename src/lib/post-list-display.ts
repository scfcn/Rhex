export const POST_LIST_DISPLAY_MODE_DEFAULT = "DEFAULT"
export const POST_LIST_DISPLAY_MODE_GALLERY = "GALLERY"

export type PostListDisplayMode = typeof POST_LIST_DISPLAY_MODE_DEFAULT | typeof POST_LIST_DISPLAY_MODE_GALLERY

export function normalizePostListDisplayMode(value: unknown, fallback: PostListDisplayMode = POST_LIST_DISPLAY_MODE_DEFAULT): PostListDisplayMode {
  return value === POST_LIST_DISPLAY_MODE_GALLERY ? POST_LIST_DISPLAY_MODE_GALLERY : fallback
}

export function normalizeNullablePostListDisplayMode(value: unknown): PostListDisplayMode | null {
  if (value === POST_LIST_DISPLAY_MODE_DEFAULT || value === POST_LIST_DISPLAY_MODE_GALLERY) {
    return value
  }

  return null
}

export function resolvePostListDisplayMode(parent?: unknown, child?: unknown) {
  return normalizePostListDisplayMode(child, normalizePostListDisplayMode(parent))
}
