// No one-time purchases in this evaluation app. Kept for DeepSpace catalog discovery.
export const oneTimeProducts = [] as const
export type ProductId = (typeof oneTimeProducts)[number] extends never
  ? string
  : (typeof oneTimeProducts)[number]['productId']
