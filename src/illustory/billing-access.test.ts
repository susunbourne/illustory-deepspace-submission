import { describe, expect, it } from 'vitest'
import { canSpendOwnerCredits } from './billing-access'

describe('sponsored spending identity', () => {
  it('pauses new spending for the owner and approved accounts', () => {
    const env = { OWNER_USER_ID: 'owner', BILLING_ALLOWED_USER_IDS: 'reviewer', SPENDING_PAUSED: '1' }
    expect(canSpendOwnerCredits(env, 'owner')).toBe(false)
    expect(canSpendOwnerCredits(env, 'reviewer')).toBe(false)
  })
  it('fails closed without app identity or caller, even with a configured allowlist', () => {
    expect(canSpendOwnerCredits({ BILLING_ALLOWED_USER_IDS: 'reviewer' }, 'reviewer')).toBe(false)
    expect(canSpendOwnerCredits({ OWNER_USER_ID: 'owner' }, undefined)).toBe(false)
    expect(
      canSpendOwnerCredits({ OWNER_USER_ID: 'owner', BILLING_ALLOWED_USER_IDS: 'anon-1' }, 'anon-1'),
    ).toBe(false)
  })
  it('allows only the app owner or exact explicitly approved IDs', () => {
    const env = { OWNER_USER_ID: 'owner', BILLING_ALLOWED_USER_IDS: ' reviewer-1, reviewer-2 , * ' }
    expect(canSpendOwnerCredits(env, 'owner')).toBe(true)
    expect(canSpendOwnerCredits(env, 'reviewer-1')).toBe(true)
    expect(canSpendOwnerCredits(env, 'reviewer')).toBe(false)
    expect(canSpendOwnerCredits(env, 'anyone')).toBe(false)
    expect(canSpendOwnerCredits(env, '*')).toBe(false)
  })
})
