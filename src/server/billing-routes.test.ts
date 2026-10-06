import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { registerActionRoutes } from './action-routes'
import { registerAuthAndIntegrationRoutes } from './http-routes'
import { registerRealtimeRoutes } from './realtime-routes'

const upstream = vi.hoisted(() => vi.fn())
vi.mock('deepspace/worker', () => ({ apiWorkerFetch: upstream, enqueueJob: vi.fn() }))

describe('HTTP spending boundary', () => {
  beforeEach(() => upstream.mockClear())
  function app(caller: string | null) {
    const app = new Hono()
    registerAuthAndIntegrationRoutes(app as never)
    registerRealtimeRoutes(app as never)
    registerActionRoutes(app as never, async () =>
      caller ? ({ userId: caller, claims: {} } as never) : null,
    )
    return app
  }
  const env = { OWNER_USER_ID: 'owner', RECORD_ROOMS: { idFromName: () => 'test', get: () => ({}) } }
  it.each(['requestJob', 'listVoices', 'searchReferences'])(
    'denies %s using verified identity, regardless of spoofed owner headers and params',
    async (action) => {
      const response = await app('visitor').request(
        `/api/actions/${action}`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer test',
            'Content-Type': 'application/json',
            'X-User-Id': 'owner',
            'X-App-Action': 'true',
          },
          body: JSON.stringify({ userId: 'owner', approved: true, operation: 'parse' }),
        },
        env,
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: 'spending_not_approved' })
      expect(upstream).not.toHaveBeenCalled()
    },
  )
  it('requires authentication even for the read-only access indicator', async () => {
    const response = await app(null).request(
      '/api/actions/getBillingAccess',
      { method: 'POST', body: '{}' },
      env,
    )
    expect(response.status).toBe(401)
  })
  it.each(['owner', 'visitor'])('returns only the caller’s approval for %s', async (caller) => {
    const response = await app(caller).request(
      '/api/actions/getBillingAccess',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer test' },
        body: '{}',
      },
      env,
    )
    expect(await response.json()).toEqual({ success: true, data: { approved: caller === 'owner' } })
  })
  it.each(['/api/integrations/openai/generate-image', '/api/integrations/email/send', '/api/integrations'])(
    'keeps generic Catalog bypass closed: %s',
    async (path) => {
      const response = await app('visitor').request(path, { method: 'POST', body: '{}' }, env)
      expect(response.status).toBe(404)
      expect(upstream).not.toHaveBeenCalled()
    },
  )
  it('keeps direct browser job writes closed', async () => {
    const response = await app('visitor').request('/ws/jobs/app:test', {}, env)
    expect(response.status).toBe(403)
  })
})
