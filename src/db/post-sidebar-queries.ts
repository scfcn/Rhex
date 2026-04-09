import { prisma } from "@/db/client"

export async function findPostSidebarData(
  postId: string,
  authorUsername: string,
  relatedPostsLimit = 5,
  currentUserId?: number | null,
) {
  const [author, postTags, relatedPosts, favoriteCollections] = await Promise.all([
    prisma.user.findUnique({
      where: { username: authorUsername },
      select: {
        bio: true,
      },
    }),


    prisma.postTag.findMany({
      where: { postId },
      include: { tag: true },
      take: 8,
    }),
    prisma.post.findMany({
      where: {
        id: { not: postId },
        status: "NORMAL",
        OR: [
          {
            author: {
              username: authorUsername,
            },
          },
        ],
      },
      select: {
        id: true,
        slug: true,
        title: true,
      },
      take: relatedPostsLimit,
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.favoriteCollectionItem.findMany({
      where: {
        postId,
        collection: currentUserId
          ? {
              OR: [
                { visibility: "PUBLIC" },
                { ownerId: currentUserId },
              ],
            }
          : {
              visibility: "PUBLIC",
            },
      },
      select: {
        collection: {
          select: {
            id: true,
            title: true,
            visibility: true,
          },
        },
      },
      orderBy: [
        { collection: { updatedAt: "desc" } },
        { collection: { title: "asc" } },
      ],
      take: 10,
    }),
  ])

  return { author, postTags, relatedPosts, favoriteCollections }
}
