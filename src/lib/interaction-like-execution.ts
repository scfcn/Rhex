import type { CurrentUserRecord } from "@/db/current-user"
import { prisma } from "@/db/client"
import { NotificationType, TargetType } from "@/db/types"

import { toggleCommentLike, togglePostLike } from "@/db/interaction-queries"
import { handlePostLikeSideEffects } from "@/lib/interaction-side-effects"
import { enqueueSyncUserReceivedLikes } from "@/lib/level-system"
import { enqueueNotification } from "@/lib/notification-writes"
import { logRequestSucceeded } from "@/lib/request-log"
import { revalidateUserSurfaceCache } from "@/lib/user-surface"
import { withRequestWriteGuard, withWriteGuard } from "@/lib/write-guard"
import { createRequestWriteGuardOptions, createWriteGuardOptions } from "@/lib/write-guard-policies"

type LikeExecutionActor = Pick<CurrentUserRecord, "id" | "username" | "nickname" | "status">

interface InteractionExecutionLogOptions {
  scope: string
  action: string
  extra?: Record<string, unknown>
}

function assertLikeActorStatus(actor: LikeExecutionActor) {
  if (actor.status === "ACTIVE" || actor.status === "MUTED") {
    return
  }

  if (actor.status === "BANNED") {
    throw new Error("当前账号已被拉黑，无法点赞")
  }

  throw new Error("当前账号状态不可执行该操作")
}

async function runLikeWriteGuard<T>(
  policyName: "posts-like" | "comments-like",
  input: Record<string, unknown>,
  actorId: number,
  request: Request | undefined,
  task: () => Promise<T>,
) {
  if (request) {
    return withRequestWriteGuard(createRequestWriteGuardOptions(policyName, {
      request,
      userId: actorId,
      input,
    }), task)
  }

  return withWriteGuard({
    ...createWriteGuardOptions(policyName, {
      userId: actorId,
      input,
    }),
    identity: {
      userId: actorId,
    },
  }, task)
}

export async function ensurePostLiked(input: {
  actor: LikeExecutionActor
  postId: string
  request?: Request
  log?: InteractionExecutionLogOptions
}) {
  assertLikeActorStatus(input.actor)

  return runLikeWriteGuard("posts-like", {
    postId: input.postId,
  }, input.actor.id, input.request, async () => {
    const [post, existingLike] = await Promise.all([
      prisma.post.findUnique({
        where: { id: input.postId },
        select: {
          id: true,
          authorId: true,
          title: true,
        },
      }),
      prisma.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: input.actor.id,
            targetType: TargetType.POST,
            targetId: input.postId,
          },
        },
        select: {
          id: true,
        },
      }),
    ])

    if (!post) {
      throw new Error("帖子不存在或暂不可点赞")
    }

    if (existingLike) {
      if (input.log) {
        logRequestSucceeded({
          scope: input.log.scope,
          action: input.log.action,
          userId: input.actor.id,
          targetId: input.postId,
        }, {
          liked: true,
          changed: false,
          ...(input.log.extra ?? {}),
        })
      }

      return {
        postId: input.postId,
        liked: true as const,
        changed: false,
        targetUserId: post.authorId ?? null,
      }
    }

    const result = await togglePostLike({
      userId: input.actor.id,
      postId: input.postId,
      senderName: input.actor.nickname ?? input.actor.username,
    })

    if (!result.liked) {
      throw new Error("帖子点赞失败")
    }

    await handlePostLikeSideEffects({
      liked: true,
      postId: input.postId,
      userId: input.actor.id,
      targetUserId: result.targetUserId,
    })

    if (result.targetUserId) {
      revalidateUserSurfaceCache(result.targetUserId)
    }

    if (result.notificationTargetUserId) {
      void enqueueNotification({
        userId: result.notificationTargetUserId,
        type: NotificationType.LIKE,
        senderId: input.actor.id,
        relatedType: "POST",
        relatedId: input.postId,
        title: "你的帖子收到了赞",
        content: `${input.actor.nickname ?? input.actor.username} 赞了你的帖子：${result.postTitle}`,
      })
    }

    if (input.log) {
      logRequestSucceeded({
        scope: input.log.scope,
        action: input.log.action,
        userId: input.actor.id,
        targetId: input.postId,
      }, {
        liked: true,
        changed: true,
        ...(input.log.extra ?? {}),
      })
    }

    return {
      postId: input.postId,
      liked: true as const,
      changed: true,
      targetUserId: result.targetUserId,
    }
  })
}

export async function ensureCommentLiked(input: {
  actor: LikeExecutionActor
  commentId: string
  request?: Request
  log?: InteractionExecutionLogOptions
}) {
  assertLikeActorStatus(input.actor)

  return runLikeWriteGuard("comments-like", {
    commentId: input.commentId,
  }, input.actor.id, input.request, async () => {
    const [comment, existingLike] = await Promise.all([
      prisma.comment.findUnique({
        where: { id: input.commentId },
        select: {
          id: true,
          userId: true,
          content: true,
        },
      }),
      prisma.like.findUnique({
        where: {
          userId_targetType_targetId: {
            userId: input.actor.id,
            targetType: TargetType.COMMENT,
            targetId: input.commentId,
          },
        },
        select: {
          id: true,
        },
      }),
    ])

    if (!comment) {
      throw new Error("评论不存在或暂不可点赞")
    }

    if (existingLike) {
      if (input.log) {
        logRequestSucceeded({
          scope: input.log.scope,
          action: input.log.action,
          userId: input.actor.id,
          targetId: input.commentId,
        }, {
          liked: true,
          changed: false,
          ...(input.log.extra ?? {}),
        })
      }

      return {
        commentId: input.commentId,
        liked: true as const,
        changed: false,
        targetUserId: comment.userId ?? null,
      }
    }

    const result = await toggleCommentLike({
      userId: input.actor.id,
      commentId: input.commentId,
      senderName: input.actor.nickname ?? input.actor.username,
    })

    if (!result.liked) {
      throw new Error("评论点赞失败")
    }

    if (result.targetUserId) {
      void enqueueSyncUserReceivedLikes(result.targetUserId, { notifyOnUpgrade: true })
      revalidateUserSurfaceCache(result.targetUserId)
    }

    if (result.notificationTargetUserId) {
      void enqueueNotification({
        userId: result.notificationTargetUserId,
        type: NotificationType.LIKE,
        senderId: input.actor.id,
        relatedType: "COMMENT",
        relatedId: input.commentId,
        title: "你的评论收到了赞",
        content: `${input.actor.nickname ?? input.actor.username} 赞了你的评论：${result.commentPreview}`,
      })
    }

    if (input.log) {
      logRequestSucceeded({
        scope: input.log.scope,
        action: input.log.action,
        userId: input.actor.id,
        targetId: input.commentId,
      }, {
        liked: true,
        changed: true,
        ...(input.log.extra ?? {}),
      })
    }

    return {
      commentId: input.commentId,
      liked: true as const,
      changed: true,
      targetUserId: result.targetUserId,
    }
  })
}
