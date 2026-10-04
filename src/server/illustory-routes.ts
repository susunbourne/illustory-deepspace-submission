import type { Hono } from 'hono'
import type { VerifyResult } from 'deepspace/worker'
import { resolveSessionReadAuth } from 'deepspace/worker'
import type { AppContext, Env } from '../../worker'
import type { Asset, Membership, Row } from '../illustory/types'
import { fetchPrivateAsset } from '../illustory/private-workflow'

async function read<T>(env: Env, tool: string, params: Record<string, unknown>): Promise<T | null> {
  const room = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const res = await room.fetch(new Request('https://internal/api/tools/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': env.OWNER_USER_ID, 'X-App-Action': 'true' },
    body: JSON.stringify({ tool, params }),
  }))
  const value = await res.json() as { success: boolean; data?: T }
  return value.success ? value.data ?? null : null
}

export function registerIllustoryRoutes(app: Hono<AppContext>, resolveAuth: (req: Request, env: Env) => Promise<VerifyResult | null>) {
  app.get('/api/illustory/assets/:assetId/content', async c => {
    const auth = (await resolveAuth(c.req.raw, c.env)) ?? (await resolveSessionReadAuth(c.req.raw, c.env))
    if (!auth) return c.json({ error: 'Unauthorized' }, 401)
    const assetId = c.req.param('assetId')
    const a = await read<{ record: Row<Asset> }>(c.env, 'records.get', { collection: 'assets', recordId: assetId })
    if (!a) return c.json({ error: 'Not found' }, 404)
    const access = await read<{ records: Row<Membership>[] }>(c.env, 'records.query', { collection: 'memberships', where: { workspaceId: a.record.data.workspaceId, userId: auth.userId }, limit: 10 })
    if (!access?.records.some(m => m.data.status === 'active')) return c.json({ error: 'Forbidden' }, 403)
    try {
      const range = c.req.header('Range')
      if (range && !/^bytes=\d*-\d*$/.test(range)) return c.json({ error: 'Invalid range' }, 416)
      const upstream = await fetchPrivateAsset(c.env, a.record.data.storageKey, undefined, range)
      const headers = new Headers({ 'Content-Type': a.record.data.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
      for (const name of ['Content-Length', 'Content-Range', 'Accept-Ranges']) {
        const value = upstream.headers.get(name)
        if (value) headers.set(name, value)
      }
      return new Response(upstream.body, { status: upstream.status, headers })
    } catch {
      return c.json({ error: 'Private asset unavailable' }, 502)
    }
  })
}
