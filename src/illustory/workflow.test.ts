import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actions } from '../actions'
import { runJob } from '../jobs'
import type { Project, WorkflowJob } from './types'
import { validStoryboard } from './validation'

const enqueueJob = vi.hoisted(() => vi.fn(async () => 'queue-1'))
vi.mock('deepspace/worker', () => ({ enqueueJob }))

type Stored = { recordId: string; data: Record<string, unknown> }
class Records {
  tables = new Map<string, Map<string, Stored>>()
  failNextJobSuccess = false
  insert(collection: string, id: string, data: Record<string, unknown>) {
    if (!this.tables.has(collection)) this.tables.set(collection, new Map())
    this.tables.get(collection)!.set(id, { recordId: id, data })
  }
  get(collection: string, id: string) { return this.tables.get(collection)?.get(id) }
  async execute(tool: string, params: Record<string, unknown>) {
    const collection = String(params.collection)
    if (tool === 'records.get') {
      const record = this.get(collection, String(params.recordId))
      return record ? { success: true, data: { record } } : { success: false, error: 'Not found' }
    }
    if (tool === 'records.query') {
      const where = (params.where ?? {}) as Record<string, unknown>
      const records = [...(this.tables.get(collection)?.values() ?? [])].filter(r => Object.entries(where).every(([k,v]) => r.data[k] === v))
      return { success: true, data: { records, count: records.length } }
    }
    if (tool === 'records.create') {
      const id = String(params.recordId ?? crypto.randomUUID())
      if (this.get(collection, id)) return { success: false, error: 'Record already exists' }
      this.insert(collection, id, params.data as Record<string, unknown>)
      return { success: true, data: { recordId: id } }
    }
    if (tool === 'records.update') {
      const id = String(params.recordId), record = this.get(collection, id)
      if (!record) return { success: false, error: 'Not found' }
      if (collection === 'workflow-jobs' && (params.data as Record<string, unknown>).status === 'succeeded' && this.failNextJobSuccess) {
        this.failNextJobSuccess = false
        throw new Error('Simulated Worker interruption')
      }
      record.data = { ...record.data, ...(params.data as Record<string, unknown>) }
      return { success: true, data: { recordId: id } }
    }
    if (tool === 'records.delete') {
      const id = String(params.recordId)
      this.tables.get(collection)?.delete(id)
      return { success: true, data: { recordId: id } }
    }
    throw new Error(tool)
  }
  tools() {
    return {
      get: (collection: string, recordId: string) => this.execute('records.get', { collection, recordId }),
      query: (collection: string, options: Record<string, unknown>) => this.execute('records.query', { collection, ...options }),
      create: (collection: string, data: Record<string, unknown>, recordId?: string) => this.execute('records.create', { collection, data, recordId }),
      update: (collection: string, recordId: string, data: Record<string, unknown>) => this.execute('records.update', { collection, recordId, data }),
      remove: (collection: string, recordId: string) => this.execute('records.delete', { collection, recordId }),
    }
  }
  env() {
    return {
      DEEPSPACE_APP_ID: 'test-app', OWNER_USER_ID: 'owner', PRIVATE_WORKFLOW_URL: 'https://private.test', PRIVATE_WORKFLOW_TOKEN: 'test-token',
      JOB_ROOMS: {}, RECORD_ROOMS: { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
        const { tool, params } = await request.json() as { tool: string; params: Record<string, unknown> }
        return Response.json(await this.execute(tool, params))
      } }) },
    }
  }
}

function project(): Project {
  return { workspaceId: 'w', title: 'One scene', script: 'A room at dusk.', revision: 1, createdByUserId: 'owner', currentAssets: {}, lastParseJobId: '', lastParseRevision: 0,
    storyboard: { characters: [{ id: 'c', name: 'Ari', description: '' }], scenes: [{ id: 's', title: 'Room', description: '', shots: [{ id: 'q', title: 'Close up', description: '', durationSeconds: 5 }] }] } }
}
function job(operation: WorkflowJob['operation'] = 'character'): WorkflowJob {
  return { workspaceId: 'w', projectId: 'p', operation, targetType: 'character', targetId: 'c', inputRevision: 1, idempotencyKey: 'request-0001',
    status: 'queued', progress: 0, providerJobId: '', outputAssetId: '', outputVersion: 0, error: '', requestedByUserId: 'owner', request: { script: 'A room at dusk.', storyboard: project().storyboard } }
}
function seeded() {
  const records = new Records()
  records.insert('workspaces', 'w', { name: 'Studio', ownerId: 'owner' })
  for (const role of ['owner', 'editor', 'reviewer', 'viewer']) records.insert('memberships', role, { workspaceId: 'w', userId: role, role, status: 'active' })
  records.insert('projects', 'p', { ...project() })
  return records
}
async function invoke(records: Records, name: string, userId: string, params: Record<string, unknown>) {
  return actions[name]({ userId, params, tools: records.tools(), env: records.env(), callerJwt: 'test' } as never)
}

describe('workspace authorization and revisions', () => {
  it('rejects duplicate or filesystem-unsafe storyboard identifiers', () => {
    const board = project().storyboard
    expect(validStoryboard(board)).toBe(true)
    expect(validStoryboard({ ...board, scenes: [{ ...board.scenes[0], id: '../outside' }] })).toBe(false)
    expect(validStoryboard({ ...board, characters: [{ ...board.characters[0], id: 'q' }] })).toBe(false)
  })
  it('enforces owner/editor/reviewer/viewer decisions on the server', async () => {
    const r = seeded();
    expect((await invoke(r, 'createProject', 'viewer', { workspaceId: 'w', title: 'x', script: 'y' })).success).toBe(false)
    expect((await invoke(r, 'createProject', 'reviewer', { workspaceId: 'w', title: 'x', script: 'y' })).success).toBe(false)
    expect((await invoke(r, 'createProject', 'editor', { workspaceId: 'w', title: 'x', script: 'y' })).success).toBe(true)
    expect((await invoke(r, 'getProject', 'outsider', { projectId: 'p' })).success).toBe(false)
    expect((await invoke(r, 'getProject', 'viewer', { projectId: 'p' })).success).toBe(true)
    expect((await invoke(r, 'saveProject', 'reviewer', { projectId: 'p', expectedRevision: 1, title: 'Edited' })).success).toBe(false)
    expect((await invoke(r, 'saveProject', 'editor', { projectId: 'p', expectedRevision: 0, title: 'Edited' })).success).toBe(false)
    expect((await invoke(r, 'saveProject', 'editor', { projectId: 'p', expectedRevision: 1, title: 'Edited' })).success).toBe(true)
    expect(r.get('projects', 'p')?.data.revision).toBe(2)
  })
  it('only an owner may spend on a job and the idempotency key returns the same job', async () => {
    const r = seeded(), params = { projectId: 'p', expectedRevision: 1, operation: 'character', targetId: 'c', idempotencyKey: 'request-0001' }
    expect((await invoke(r, 'requestJob', 'editor', params)).success).toBe(false)
    expect((await invoke(r, 'requestJob', 'reviewer', params)).success).toBe(false)
    expect((await invoke(r, 'requestJob', 'viewer', params)).success).toBe(false)
    const first = await invoke(r, 'requestJob', 'owner', params)
    const second = await invoke(r, 'requestJob', 'owner', params)
    expect(first.success && second.success && (first.data as Stored).recordId).toBe((second.data as Stored).recordId)
    expect(enqueueJob).toHaveBeenCalledTimes(1)
    expect((await invoke(r, 'requestJob', 'owner', { ...params, targetId: 's' })).success).toBe(false)
  })
  it('concurrent requests with the same key create only one workflow row', async () => {
    const r = seeded(), params = { projectId: 'p', expectedRevision: 1, operation: 'character', targetId: 'c', idempotencyKey: 'concurrent-0001' }
    enqueueJob.mockClear()
    const [first, second] = await Promise.all([invoke(r, 'requestJob', 'owner', params), invoke(r, 'requestJob', 'owner', params)])
    expect(first.success && second.success).toBe(true)
    expect((first.data as Stored).recordId).toBe((second.data as Stored).recordId)
    expect(r.tables.get('workflow-jobs')?.size).toBe(1)
    expect(enqueueJob).toHaveBeenCalledTimes(1)
  })
  it('lets a reviewer request a deterministic export after a video is selected', async () => {
    const r = seeded();
    (r.get('projects', 'p')!.data.currentAssets as Record<string, string>)['h3:q'] = 'video-a'
    r.insert('assets', 'video-a', { workspaceId: 'w', projectId: 'p', operation: 'h3', targetId: 'q', storageKey: 'projects/p/video.mp4', mimeType: 'video/mp4', sha256: 'a'.repeat(64), byteSize: 100 })
    const params = { projectId: 'p', expectedRevision: 1, operation: 'export', targetId: 'p', idempotencyKey: 'export-0001' }
    expect((await invoke(r, 'requestJob', 'viewer', params)).success).toBe(false)
    expect((await invoke(r, 'requestJob', 'reviewer', params)).success).toBe(true)
  })
  it('does not grant unknown identities or remove the last active owner', async () => {
    const r = seeded()
    r.insert('users', 'owner', { userId: 'owner' })
    expect((await invoke(r, 'setMemberRole', 'owner', { workspaceId: 'w', userId: 'unknown', role: 'viewer' })).success).toBe(false)
    expect((await invoke(r, 'setMemberRole', 'owner', { workspaceId: 'w', userId: 'owner', role: 'editor' })).success).toBe(false)
    r.insert('users', 'new', { userId: 'new' })
    expect((await invoke(r, 'setMemberRole', 'owner', { workspaceId: 'w', userId: 'new', role: 'reviewer' })).success).toBe(true)
  })
})

describe('result publication', () => {
  beforeEach(() => { vi.restoreAllMocks(); enqueueJob.mockClear() })
  function privateResponse(status: 'succeeded' | 'failed' = 'succeeded') {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'X-Content-Sha256': 'a'.repeat(64), 'Content-Length': '200' } })
      if (url.endsWith('/v1/jobs') || url.endsWith('/v1/jobs/remote')) return Response.json(url.endsWith('/v1/jobs') ? { id: 'remote' } :
        { id: 'remote', status, progress: 1, error: status === 'failed' ? 'provider failed' : undefined,
          result: { asset: { storageKey: 'projects/p/jobs/output.png', mimeType: 'image/png', sha256: 'a'.repeat(64), byteSize: 200 } } })
      throw new Error(url)
    }))
  }
  const context = { signal: new AbortController().signal, progress: vi.fn(), continue: vi.fn() }
  async function run(r: Records) { return runJob({ type: 'illustory-workflow', payload: { jobId: 'j' } } as never, context as never, r.env() as never) }
  it('does not publish an old revision or failed provider result', async () => {
    privateResponse()
    const stale = seeded(); stale.insert('workflow-jobs', 'j', { ...job() }); stale.get('projects', 'p')!.data.revision = 2
    await run(stale)
    expect(stale.get('workflow-jobs', 'j')?.data.status).toBe('stale')
    expect(stale.tables.get('assets')?.size ?? 0).toBe(0)
    privateResponse('failed')
    const failed = seeded(); failed.insert('workflow-jobs', 'j', { ...job() })
    await expect(run(failed)).rejects.toThrow('Private job failed')
    expect(failed.get('workflow-jobs', 'j')?.data.status).toBe('failed')
    expect(failed.tables.get('assets')?.size ?? 0).toBe(0)
  })
  it('publishes one version and never republishes a duplicate or cancelled job', async () => {
    privateResponse()
    const r = seeded(); r.insert('workflow-jobs', 'j', { ...job() })
    await run(r)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
    expect(r.tables.get('assets')?.size).toBe(1)
    const current = (r.get('projects', 'p')?.data.currentAssets as Record<string,string>)['character:c']
    expect(current).toBeTruthy()
    await run(r)
    expect(r.tables.get('assets')?.size).toBe(1)
    const cancelled = seeded(); cancelled.insert('workflow-jobs', 'j', { ...job(), status: 'cancelled' })
    await run(cancelled)
    expect(cancelled.tables.get('assets')?.size ?? 0).toBe(0)
  })
  it('recovers after the asset was selected but the job status write was interrupted', async () => {
    privateResponse()
    const r = seeded(); r.insert('workflow-jobs', 'j', { ...job() }); r.failNextJobSuccess = true
    await expect(run(r)).rejects.toThrow('Simulated Worker interruption')
    expect(r.tables.get('assets')?.size).toBe(1)
    await run(r)
    expect(r.tables.get('assets')?.size).toBe(1)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
  })
  it('does not apply a parsed storyboard twice after a status-write interruption', async () => {
    const board = project().storyboard
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(url.endsWith('/v1/jobs') ? { id: 'remote' } : { id: 'remote', status: 'succeeded', progress: 1, result: { storyboard: board } })))
    const r = seeded(); r.insert('workflow-jobs', 'j', { ...job('parse'), targetType: 'project', targetId: 'p' }); r.failNextJobSuccess = true
    await expect(run(r)).rejects.toThrow('Simulated Worker interruption')
    expect(r.get('projects', 'p')?.data.revision).toBe(2)
    await run(r)
    expect(r.get('projects', 'p')?.data.revision).toBe(2)
    expect(r.get('workflow-jobs', 'j')?.data.outputVersion).toBe(2)
  })
})
