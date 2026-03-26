import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { offlineOwnPost } from "@/lib/post-offline"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const postId = String(body.postId ?? "").trim()
    const reason = String(body.reason ?? "").trim()

    if (!postId) {
      return NextResponse.json({ code: 400, message: "缺少帖子标识" }, { status: 400 })
    }

    const result = await offlineOwnPost({ postId, reason })

    revalidatePath(`/posts/${result.post.slug}`)
    revalidatePath("/")
    revalidatePath("/admin")

    return NextResponse.json({
      code: 0,
      message: result.price.amount > 0 ? `帖子已下线，扣除 ${result.price.amount} ${result.pointName}` : "帖子已下线",
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "帖子下线失败"
    return NextResponse.json({ code: 400, message }, { status: 400 })
  }
}
