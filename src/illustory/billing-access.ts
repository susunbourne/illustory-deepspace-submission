/** Spending permission is independent of a user's workspace role. */
type BillingEnv = { OWNER_USER_ID?: string; BILLING_ALLOWED_USER_IDS?: string; SPENDING_PAUSED?: string }

export const BILLING_ACCESS_ERROR = 'Paid generation, research and export require approval from the app owner. Workspace ownership does not grant sponsored credits.'

export function canSpendOwnerCredits(env: BillingEnv, userId: string | undefined): boolean {
  if (env.SPENDING_PAUSED === '1' || !env.OWNER_USER_ID || !userId || userId.startsWith('anon-')) return false
  if (userId === env.OWNER_USER_ID) return true
  // Exact verified identity IDs only. No domains, wildcard or workspace grants.
  return (env.BILLING_ALLOWED_USER_IDS ?? '').split(',').some(id => id.trim() === userId && id.trim() !== '*')
}
