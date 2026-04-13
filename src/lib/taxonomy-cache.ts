import { revalidateTag } from "next/cache"

export const BOARDS_CACHE_TAG = "taxonomy-boards"
export const ZONES_CACHE_TAG = "taxonomy-zones"

export const TAXONOMY_CACHE_TAGS = [BOARDS_CACHE_TAG, ZONES_CACHE_TAG] as const

export function revalidateTaxonomyStructureCache() {
  for (const tag of TAXONOMY_CACHE_TAGS) {
    revalidateTag(tag, "max")
  }
}
