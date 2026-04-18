/**
 * @file bridge.ts
 * @responsibility AI capability bridge —— 将主工程内的 AI capability 函数（如
 *   runAutoCategorize）发布到 globalThis 上的固定 Symbol，供 addon 运行时（纯
 *   ESM 沙盒，无法 import "@/..."）读取并调用。
 *
 * @scope Phase B.10 ai-reply addon 化过渡：addon 只登记 action hook 外壳，
 *   hook handler 通过本 bridge 间接调用主工程 capability；主工程侧只要在
 *   post/comment create execution 路径 import 本模块（side-effect），即可保证
 *   bridge 在 hook 派发前已安装。
 *
 * @version v1：runAutoCategorize（post.create.after）
 *
 * @contract
 *   - 对外稳定契约位于 globalThis[Symbol.for("bbs.ai.capabilities.v1")]；
 *     变更 contract 时必须升版本号（v2 等）并保留 v1 直至所有 addon 迁移完毕。
 *   - addon 端仅依赖 symbol key 与形状，不得 import 本文件。
 */
import "server-only"

import { runAutoCategorize } from "@/lib/ai/capabilities/auto-categorize"

/**
 * Bridge contract v1 暴露给 addon 的形状。
 * 新增能力只 append；破坏性变更 → 提升版本号。
 */
export interface AiCapabilityBridgeV1 {
  readonly version: 1
  /** post.create.after：AI 自动选板块/加标签（fire-and-forget，内部自吞错误）。 */
  runAutoCategorize: typeof runAutoCategorize
}

/** addon 端读取 bridge 时使用的稳定 key。*/
export const AI_CAPABILITY_BRIDGE_SYMBOL = Symbol.for("bbs.ai.capabilities.v1")

type BridgeHolder = Record<symbol, AiCapabilityBridgeV1 | undefined>

function install(): AiCapabilityBridgeV1 {
  const bridge: AiCapabilityBridgeV1 = {
    version: 1,
    runAutoCategorize,
  }
  ;(globalThis as unknown as BridgeHolder)[AI_CAPABILITY_BRIDGE_SYMBOL] = bridge
  return bridge
}

// 幂等：HMR / 多次 import 只装一次；但允许 hot-replace 引用（写回最新函数）。
const existing = (globalThis as unknown as BridgeHolder)[AI_CAPABILITY_BRIDGE_SYMBOL]
const bridge = existing ?? install()

/** server-side 读取 bridge（主要给测试/调试使用；addon 不走这里）。*/
export function getAiCapabilityBridge(): AiCapabilityBridgeV1 {
  return bridge
}