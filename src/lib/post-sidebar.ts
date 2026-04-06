import { findPostSidebarData } from "@/db/post-sidebar-queries"

export async function getPostSidebarData(postId: string, authorUsername: string, relatedPostsLimit = 5) {
  const { author, postTags, relatedPosts } = await findPostSidebarData(postId, authorUsername, relatedPostsLimit)

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
  }
}
