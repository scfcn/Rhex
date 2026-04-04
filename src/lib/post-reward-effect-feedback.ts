export interface PostRewardPoolEffectFeedbackEvent {
  kind: "probability" | "points"
  tone: "positive" | "negative"
  title: string
  description: string
}

export interface PostRewardPoolEffectFeedback {
  badgeName: string | null
  badgeIconText: string | null
  badgeColor: string | null
  events: PostRewardPoolEffectFeedbackEvent[]
}
