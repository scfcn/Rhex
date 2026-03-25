import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { createGobangMatch, getGobangPlayerSummary, listGobangMatches, makeGobangMove } from "@/lib/gobang"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  try {
    const [matches, summary] = await Promise.all([
      listGobangMatches(user.id),
      getGobangPlayerSummary(user),
    ])
    return NextResponse.json({ code: 0, data: { matches, summary } })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "加载对局失败" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ code: 401, message: "请先登录" }, { status: 401 })
  }

  const body = await request.json()
  const action = String(body.action ?? "")

  try {
    if (action === "create") {
      const result = await createGobangMatch(user)
      return NextResponse.json({ code: 0, message: result.policy.mode === "FREE" ? "已开始免费挑战" : "已开始付费挑战", data: result })
    }

    if (action === "move") {
      const matchId = String(body.matchId ?? "")
      const x = Number(body.x)
      const y = Number(body.y)
      const data = await makeGobangMove({ matchId, user, x, y })
      return NextResponse.json({ code: 0, message: data.winnerId === user.id ? "你赢了，奖励已到账" : data.winnerId === 0 ? "AI 获胜，再接再厉" : "落子成功", data })
    }

    return NextResponse.json({ code: 400, message: "不支持的操作" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ code: 400, message: error instanceof Error ? error.message : "五子棋操作失败" }, { status: 400 })
  }
}
