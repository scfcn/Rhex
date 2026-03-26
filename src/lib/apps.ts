export const HOST_APPS = [
  {
    id: "gobang",
    slug: "gobang",
    name: "五子棋",
    description: "人机对战应用，支持每日免费场次、付费挑战与胜利奖励。",
    href: "/funs/gobang",
    adminHref: "/admin/apps/gobang",
    category: "游戏",
  },
  {
    id: "self-serve-ads",
    slug: "self-serve-ads",
    name: "自助广告位",
    description: "首页广告位投放系统，支持图片与文字广告购买、审核与展示。",
    href: "/funs/self-serve-ads",
    adminHref: "/admin/apps/self-serve-ads",
    category: "运营",
  },
] as const

export type HostAppItem = (typeof HOST_APPS)[number]

export function getHostAppBySlug(slug: string) {
  return HOST_APPS.find((item) => item.slug === slug) ?? null
}
