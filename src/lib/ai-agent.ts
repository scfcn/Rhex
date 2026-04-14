import { getAiReplyConfig } from "@/lib/ai-reply-config"
import { withRuntimeFallback } from "@/lib/runtime-errors"

export async function getAiAgentUserId() {
  return withRuntimeFallback(async () => {
    const config = await getAiReplyConfig()
    return config.agentUserId ?? null
  }, {
    area: "ai-reply",
    action: "getAiAgentUserId",
    message: "AI 代理账号加载失败",
    fallback: null,
  })
}
