import "server-only"

import { executeAddonAsyncWaterfallHook } from "@/addons-host/runtime/hooks"
import { queryAddonPosts } from "@/addons-host/runtime/posts"
import { findPostSidebarData } from "@/db/post-sidebar-queries"

interface PostSidebarRelatedTopic {
  id: string
  slug: string
  title: string
}

function normalizeUniquePostIds(postIds: string[]) {
  const seen = new Set<string>()

  return postIds.filter((postId) => {
    const normalizedPostId = postId.trim()
    if (!normalizedPostId || seen.has(normalizedPostId)) {
      return false
    }

    seen.add(normalizedPostId)
    return true
  })
}

async function resolveHookedRelatedTopics(input: {
  postId: string
  relatedTopics: PostSidebarRelatedTopic[]
  pathname?: string
  searchParams?: URLSearchParams
}) {
  const orderedIds = normalizeUniquePostIds(
    input.relatedTopics.map((item) => item.id),
  )

  if (orderedIds.length === 0) {
    return [] as PostSidebarRelatedTopic[]
  }

  const queried = await queryAddonPosts({
    ids: orderedIds,
    includeTotal: false,
    limit: orderedIds.length,
  })
  const queriedById = new Map(queried.items.map((item) => [item.id, item]))
  const initialItems = orderedIds
    .map((postId) => queriedById.get(postId) ?? null)
    .filter((item) => item !== null)
  const hooked = await executeAddonAsyncWaterfallHook(
    "post.related.items",
    initialItems,
    {
      pathname: input.pathname,
      searchParams: input.searchParams,
    },
  )

  return [...new Map(
    (Array.isArray(hooked.value) ? hooked.value : initialItems)
      .filter((item) => item.id !== input.postId)
      .map((item) => [
        item.id,
        {
          id: item.id,
          slug: item.slug,
          title: item.title,
        } satisfies PostSidebarRelatedTopic,
      ]),
  ).values()]
}

export async function getPostSidebarData(
  postId: string,
  authorUsername: string,
  relatedPostsLimit = 5,
  currentUserId?: number | null,
  input?: {
    pathname?: string
    searchParams?: URLSearchParams
  },
) {
  const { author, postTags, relatedPosts, favoriteCollections } = await findPostSidebarData(
    postId,
    authorUsername,
    relatedPostsLimit,
    currentUserId,
  )
  const relatedTopics = await resolveHookedRelatedTopics({
    postId,
    relatedTopics: relatedPosts,
    pathname: input?.pathname,
    searchParams: input?.searchParams,
  })

  return {
    author: author
      ? {
          bio: author.bio,
        }
      : {
          bio: null,
        },
    relatedTopics,
    tags: postTags.map((item) => ({
      id: item.tag.id,
      name: item.tag.name,
      slug: item.tag.slug,
    })),
    collections: favoriteCollections.map((item) => ({
      id: item.collection.id,
      title: item.collection.title,
      visibility: item.collection.visibility,
    })),
  }
}
