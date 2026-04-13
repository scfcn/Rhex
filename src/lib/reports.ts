import { RelatedType, TargetType } from "@/db/types"


import {
  countReportsByStatus,
  createReportRecord,
  createReportResultNotification,
  findAdminReportsPage,
  findDuplicatedPendingReport,
  findReportById,
  findReportTargetComment,
  findReportTargetComments,
  findReportTargetPost,
  findReportTargetPosts,
  findReportTargetUser,
  findReportTargetUsers,
} from "@/db/report-queries"
import { resolvePagination } from "@/db/helpers"
import { apiError } from "@/lib/api-route"
import { enforceSensitiveText } from "@/lib/content-safety"




import type { AdminReportListResult } from "@/lib/admin-report-management"
import { getPostCommentPath, getPostPath } from "@/lib/post-links"
import { getSiteSettings, type PostLinkDisplayMode } from "@/lib/site-settings"
import { getUserDisplayName } from "@/lib/users"

export interface CreateReportInput {
  reporterId: number
  targetType: TargetType
  targetId: string
  reasonType: string
  reasonDetail?: string | null
}

async function resolveReportTarget(targetType: TargetType, targetId: string) {
  const settings = await getSiteSettings()
  return resolveReportTargetWithMode(targetType, targetId, settings.postLinkDisplayMode)
}

function mapPostReportTarget(
  post: NonNullable<Awaited<ReturnType<typeof findReportTargetPost>>>,
  postLinkDisplayMode: PostLinkDisplayMode,
) {
  return {
    title: post.title,
    description: `帖子作者：${getUserDisplayName(post.author)}`,
    href: getPostPath({ id: post.id, slug: post.slug }, { mode: postLinkDisplayMode }),
    ownerUserId: null as number | null,
    relatedType: RelatedType.POST,
    relatedId: post.id,
  }
}

function mapCommentReportTarget(
  comment: NonNullable<Awaited<ReturnType<typeof findReportTargetComment>>>,
  postLinkDisplayMode: PostLinkDisplayMode,
) {
  return {
    title: `评论：${comment.post.title}`,
    description: `评论人：${getUserDisplayName(comment.user)} · ${comment.content.slice(0, 56) || "无内容"}`,
    href: getPostCommentPath({ id: comment.post.id, slug: comment.post.slug, title: comment.post.title }, comment.id, { mode: postLinkDisplayMode }),
    ownerUserId: comment.userId,
    relatedType: RelatedType.COMMENT,
    relatedId: comment.id,
  }
}

function mapUserReportTarget(
  user: NonNullable<Awaited<ReturnType<typeof findReportTargetUser>>>,
  targetId: string,
) {
  return {
    title: `用户：${getUserDisplayName(user)}`,
    description: user.bio?.slice(0, 72) || `账号 @${user.username}`,
    href: `/users/${user.username}`,
    ownerUserId: user.id,
    relatedType: RelatedType.REPORT,
    relatedId: targetId,
  }
}

async function resolveReportTargetWithMode(targetType: TargetType, targetId: string, postLinkDisplayMode: PostLinkDisplayMode) {

  if (targetType === TargetType.POST) {

    const post = await findReportTargetPost(targetId)


    if (!post) {
      return null
    }

    return mapPostReportTarget(post, postLinkDisplayMode)
  }

  if (targetType === TargetType.COMMENT) {
    const comment = await findReportTargetComment(targetId)


    if (!comment) {
      return null
    }

    return mapCommentReportTarget(comment, postLinkDisplayMode)
  }

  const user = await findReportTargetUser(targetId)


  if (!user) {
    return null
  }

  return mapUserReportTarget(user, targetId)
}

async function resolveReportTargets(
  reports: Array<{ targetType: TargetType; targetId: string }>,
  postLinkDisplayMode: PostLinkDisplayMode,
) {
  const postIds = reports.filter((report) => report.targetType === TargetType.POST).map((report) => report.targetId)
  const commentIds = reports.filter((report) => report.targetType === TargetType.COMMENT).map((report) => report.targetId)
  const userIds = reports.filter((report) => report.targetType === TargetType.USER).map((report) => report.targetId)

  const [posts, comments, users] = await Promise.all([
    findReportTargetPosts(postIds),
    findReportTargetComments(commentIds),
    findReportTargetUsers(userIds),
  ])

  const postMap = new Map(posts.map((post) => [post.id, mapPostReportTarget(post, postLinkDisplayMode)]))
  const commentMap = new Map(comments.map((comment) => [comment.id, mapCommentReportTarget(comment, postLinkDisplayMode)]))
  const userMap = new Map(users.map((user) => [String(user.id), mapUserReportTarget(user, String(user.id))]))

  return reports.map((report) => {
    if (report.targetType === TargetType.POST) {
      return postMap.get(report.targetId) ?? null
    }

    if (report.targetType === TargetType.COMMENT) {
      return commentMap.get(report.targetId) ?? null
    }

    return userMap.get(report.targetId) ?? null
  })
}

export async function createReport(input: CreateReportInput) {
  const normalizedReasonType = input.reasonType.trim()
  const normalizedReasonDetail = input.reasonDetail?.trim() || null

  if (!normalizedReasonType) {
    apiError(400, "请选择举报原因")
  }

  const target = await resolveReportTarget(input.targetType, input.targetId)

  if (!target) {
    apiError(404, "举报目标不存在或已被删除")
  }

  if (target.ownerUserId && target.ownerUserId === input.reporterId) {
    apiError(400, "不能举报自己")
  }

  const duplicatedReport = await findDuplicatedPendingReport(input.reporterId, input.targetType, input.targetId)

  if (duplicatedReport) {
    apiError(409, "你已经举报过该内容，处理中请耐心等待")
  }


  const reasonDetailSafety = normalizedReasonDetail
    ? await enforceSensitiveText({ scene: "report.reasonDetail", text: normalizedReasonDetail })
    : null
  const report = await createReportRecord({
    reporterId: input.reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reasonType: normalizedReasonType,
    reasonDetail: reasonDetailSafety?.sanitizedText ?? null,
  })

  return {
    ...report,
    contentAdjusted: Boolean(reasonDetailSafety?.wasReplaced),
  }
}

export async function getAdminReports(options: { page?: number; pageSize?: number } = {}): Promise<AdminReportListResult> {
  const [total, pending, processing, resolved, rejected] = await countReportsByStatus()
  const pagination = resolvePagination(options, total)

  const settings = await getSiteSettings()
  const reports = await findAdminReportsPage(pagination.skip, pagination.pageSize)
  const targetSummaries = await resolveReportTargets(reports, settings.postLinkDisplayMode)


  return {
    reports: reports.map((report, index) => ({
      id: report.id,
      targetType: report.targetType,
      targetId: report.targetId,
      reasonType: report.reasonType,
      reasonDetail: report.reasonDetail,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      handledAt: report.handledAt?.toISOString() ?? null,
      handledNote: report.handledNote ?? null,
      reporter: {
        id: report.reporter.id,
        username: report.reporter.username,
        displayName: getUserDisplayName(report.reporter),
      },
      handler: report.handler
        ? {
            id: report.handler.id,
            username: report.handler.username,
            displayName: getUserDisplayName(report.handler),
          }
        : null,
      targetSummary: targetSummaries[index] ?? {
        title: "目标已不存在",
        description: `原始目标 ID：${report.targetId}`,
        href: "/admin?tab=reports",
      },
    })),
    summary: {
      total,
      pending,
      processing,
      resolved,
      rejected,
    },
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
      hasPrevPage: pagination.hasPrevPage,
      hasNextPage: pagination.hasNextPage,
    },

  }
}

export async function notifyReportResult(reportId: string, handledByUserId: number, passed: boolean, handledNote: string) {
  const report = await findReportById(reportId)


  if (!report) {
    return
  }

  const target = await resolveReportTarget(report.targetType, report.targetId)
  const resultLabel = passed ? "举报已成立" : "举报未通过"

  await createReportResultNotification({
    userId: report.reporterId,
    senderId: handledByUserId,
    relatedType: target?.relatedType ?? RelatedType.REPORT,
    relatedId: target?.relatedId ?? report.id,
    title: resultLabel,
    content: `${target?.title ?? "你举报的内容"}：${handledNote || (passed ? "管理员已确认违规并处理。" : "管理员复核后认为不构成违规。")}`,
  })

}
