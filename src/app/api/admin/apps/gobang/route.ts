import { NextResponse } from "next/server"

import { requireAdminUser } from "@/lib/admin"
import { updateGobangAppConfig } from "@/lib/app-config"

export async function POST(request: Request) {
  const admin = await requireAdminUser()
  if (!admin) {
    return NextResponse.json({ code: 403, message: "无权操作" }, { status: 403 })
  }

  const body = await request.json()
  const config = body.config && typeof body.config === "object" ? body.config as Record<string, unknown> : {}

  try {
    const data = await updateGobangAppConfig(config)
    return NextResponse.json({ code: 0, message: "应用配置已保存", data })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "配置保存失败" }, { status: 400 })
  }
}
