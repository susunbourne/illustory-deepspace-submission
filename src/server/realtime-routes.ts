import type { Hono } from 'hono'
import type { AppContext } from '../../worker'

// This app exposes workspace-scoped job state only through authenticated
// actions. The scaffold's generic app-wide WebSocket rooms cannot enforce
// workspace membership and must not be reachable from a browser.
export function registerRealtimeRoutes(app: Hono<AppContext>): void {
  app.all('/ws/*', () => new Response('Forbidden', { status: 403 }))
}
