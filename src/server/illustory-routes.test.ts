import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { registerIllustoryRoutes } from './illustory-routes'

vi.mock('deepspace/worker', () => ({ resolveSessionReadAuth: vi.fn(async () => null) }))

function env() {
  const asset = { recordId: 'asset-1', data: { workspaceId: 'workspace-1', storageKey: 'projects/p/jobs/j/output.png', mimeType: 'image/png' } }
  return {
    PRIVATE_WORKFLOW_URL: 'https://private.test', PRIVATE_WORKFLOW_TOKEN: 'private-test-token', DEEPSPACE_APP_ID: 'app-1', OWNER_USER_ID: 'owner',
    RECORD_ROOMS: { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
      const { tool, params } = await request.json() as { tool: string; params: Record<string, unknown> }
      if (tool === 'records.get') return Response.json({ success: true, data: { record: asset } })
      if (tool === 'records.query') return Response.json({ success: true, data: { records: params.where && (params.where as { userId: string }).userId === 'member'
        ? [{ recordId: 'membership-1', data: { workspaceId: 'workspace-1', userId: 'member', role: 'viewer', status: 'active' } }] : [] } })
      return Response.json({ success: false })
    } }) },
  }
}

describe('private asset proxy', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('rejects a signed-in nonmember before contacting the private service', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const app = new Hono()
    registerIllustoryRoutes(app as never, async () => ({ userId: 'outsider' }) as never)
    const response = await app.request('/api/illustory/assets/asset-1/content', {}, env())
    expect(response.status).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
  })
  it('streams only an active workspace member’s private asset', async () => {
    const upstream = vi.fn(async () => new Response('image-bytes', { status: 200, headers: { 'Content-Length': '11' } }))
    vi.stubGlobal('fetch', upstream)
    const app = new Hono()
    registerIllustoryRoutes(app as never, async () => ({ userId: 'member' }) as never)
    const response = await app.request('/api/illustory/assets/asset-1/content', {}, env())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('image-bytes')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(upstream).toHaveBeenCalledTimes(1)
  })
})
