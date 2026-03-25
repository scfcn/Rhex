import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { requireAdminUser } from "@/lib/admin"
import { updateSelfServeAdsAppConfig } from "@/lib/app-config"
import { getSelfServeAdsAdminData, reviewSelfServeAdOrder } from "@/lib/self-serve-ads"

export async function GET() {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权访问" }, { status: 403 })
  }

  try {
    const data = await getSelfServeAdsAdminData()
    return NextResponse.json({ code: 0, data })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "广告后台数据加载失败" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const body = await request.json()

  try {
    if (body.action === "save-config") {
      const config = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : {}
      const data = await updateSelfServeAdsAppConfig(config)
      revalidatePath("/")
      revalidatePath("/admin/apps/self-serve-ads")
      return NextResponse.json({ code: 0, message: "应用配置已保存", data })
    }

    await reviewSelfServeAdOrder({
      id: String(body.id ?? ""),
      action: body.action,
      reviewNote: body.reviewNote,
      slotIndex: body.slotIndex,
      title: body.title,
      linkUrl: body.linkUrl,
      imageUrl: body.imageUrl,
      textColor: body.textColor,
      backgroundColor: body.backgroundColor,
      durationMonths: body.durationMonths,
    })

    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath("/admin/apps/self-serve-ads")
    return NextResponse.json({ code: 0, message: "广告订单已更新" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "广告订单更新失败" }, { status: 400 })
  }
}
