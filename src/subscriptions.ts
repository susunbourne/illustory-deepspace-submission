// No paid subscriptions in this evaluation app. Kept for DeepSpace catalog discovery.
export const subscriptionPlans = [] as const
export type SubscriptionPlanSlug = (typeof subscriptionPlans)[number] extends never
  ? string
  : (typeof subscriptionPlans)[number]['slug']
