import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { submitSelfServeAdOrder } from "@/lib/self-serve-ads"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    await submitSelfServeAdOrder({
      slotType: body.slotType,
      slotIndex: Number(body.slotIndex ?? 0),
      title: body.title ?? "",
      linkUrl: body.linkUrl ?? "",
      imageUrl: body.imageUrl ?? "",
      textColor: body.textColor ?? "#0f172a",
      backgroundColor: body.backgroundColor ?? "#f8fafc",
      durationMonths: body.durationMonths,
    })

    revalidatePath("/")
    revalidatePath("/funs/self-serve-ads")
    return NextResponse.json({ code: 0, message: "广告申请已提交，待管理员审核" })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "广告申请提交失败" }, { status: 400 })
  }
}
