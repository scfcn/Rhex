import { findPostSidebarData } from "@/db/post-sidebar-queries"

export async function getPostSidebarData(
  postId: string,
  authorUsername: string,
  relatedPostsLimit = 5,
  currentUserId?: number | null,
) {
  const { author, postTags, relatedPosts, favoriteCollections } = await findPostSidebarData(
    postId,
    authorUsername,
    relatedPostsLimit,
    currentUserId,
  )

  return {
    author: author
      ? {
          bio: author.bio,
        }
      : {
          bio: null,
        },
    relatedTopics: relatedPosts,
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
