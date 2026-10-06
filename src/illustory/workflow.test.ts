import { beforeEach, describe, expect, it, vi } from 'vitest'
import { actions } from '../actions'
import { runJob } from '../jobs'
import type { Project, WorkflowJob } from './types'
import { validStoryboard } from './validation'
import { characterReply, sceneReply } from './original-creative.test'
import { verifyPrivateAsset } from './private-workflow'

it('verifies saved catalog bytes when a HEAD intermediary omits integrity metadata', async () => {
  const bytes = new Uint8Array(100).fill(7)
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('')
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => init.method === 'HEAD'
    ? new Response(null, { headers: { 'Content-Length': '0' } })
    : new Response(bytes, { headers: { 'Content-Length': '100' } }))
  vi.stubGlobal('fetch', fetchMock)
  try {
    await expect(verifyPrivateAsset({ PRIVATE_WORKFLOW_URL: 'https://private.test', PRIVATE_WORKFLOW_TOKEN: 'test' } as never,
      { storageKey: 'catalog/p/a.png', sha256: digest, byteSize: 100 }, new AbortController().signal)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1].redirect).toBe('manual')
    await expect(verifyPrivateAsset({ PRIVATE_WORKFLOW_URL: 'https://private.test', PRIVATE_WORKFLOW_TOKEN: 'test' } as never,
      { storageKey: 'catalog/p/a.png', sha256: 'a'.repeat(64), byteSize: 100 }, new AbortController().signal)).rejects.toThrow('integrity')
  } finally { vi.unstubAllGlobals() }
})

const enqueueJob = vi.hoisted(() => vi.fn(async () => 'queue-1'))

it('verifies large exports through authenticated metadata when edge HEAD loses headers', async () => {
  const asset = { storageKey: 'p/export/output.mp4', sha256: 'a'.repeat(64), byteSize: 22183196 }
  let metadata = { ...asset }
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => init.method === 'HEAD'
    ? new Response(null, { headers: { 'Content-Length': '0' } })
    : Response.json(metadata))
  vi.stubGlobal('fetch', fetchMock)
  try {
    const env = { PRIVATE_WORKFLOW_URL: 'https://private.test', PRIVATE_WORKFLOW_TOKEN: 'test' } as never
    await expect(verifyPrivateAsset(env, asset, new AbortController().signal)).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[1][0]).toContain('/v1/asset-metadata/')
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ Authorization: 'Bearer test' })
    for (const wrong of [{ ...asset, byteSize: 1 }, { ...asset, sha256: 'b'.repeat(64) }, { ...asset, storageKey: 'other' }]) {
      metadata = wrong
      await expect(verifyPrivateAsset(env, asset, new AbortController().signal)).rejects.toThrow('integrity')
    }
  } finally { vi.unstubAllGlobals() }
})
const integrationCall = vi.hoisted(() => vi.fn())
vi.mock('deepspace/worker', () => ({ enqueueJob, buildCronContext: () => ({ integrations: { call: integrationCall } }) }))

type Stored = { recordId: string; data: Record<string, unknown> }
class Records {
  tables = new Map<string, Map<string, Stored>>()
  failNextJobSuccess = false
  emailFrom = ''
  executionEnabled = true
  gpuEnabled = true
  billingAllowedUserIds = ''
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
      integration: async (endpoint: string, params: Record<string, unknown>) => ({ success: true, data: await integrationCall(endpoint, params) }),
    }
  }
  env() {
    return {
      DEEPSPACE_APP_ID: 'test-app', OWNER_USER_ID: 'owner', APP_NAME: 'test-app', PRIVATE_WORKFLOW_URL: 'https://private.test', PRIVATE_WORKFLOW_TOKEN: 'test-token', PRIVATE_WORKFLOW_EXECUTION_ENABLED: this.executionEnabled ? '1' : '0', PRIVATE_WORKFLOW_GPU_ENABLED: this.gpuEnabled ? '1' : '0', EMAIL_FROM: this.emailFrom, OPENAI_API_KEY: 'test-only',
      BILLING_ALLOWED_USER_IDS: this.billingAllowedUserIds,
      JOB_ROOMS: {}, RECORD_ROOMS: { idFromName: (name: string) => name, get: () => ({ fetch: async (request: Request) => {
        const { tool, params } = await request.json() as { tool: string; params: Record<string, unknown> }
        return Response.json(await this.execute(tool, params))
      } }) },
    }
  }
}

function project(): Project {
  return { workspaceId: 'w', title: 'One scene', description: '', script: 'A room at dusk.', revision: 1, createdByUserId: 'owner', currentAssets: {}, lastParseJobId: '', lastParseRevision: 0, notifyOnExport: false, referenceCandidates: [], referenceQuery: '',
    storyboard: { characters: [{ id: 'c', name: 'Ari', description: '' }], scenes: [{ id: 's', title: 'Room', description: '', shots: [{ id: 'q', title: 'Close up', description: '', durationSeconds: 5 }] }] } }
}
function job(operation: WorkflowJob['operation'] = 'first-frame'): WorkflowJob {
  return { workspaceId: 'w', projectId: 'p', operation, targetType: operation === 'parse' ? 'project' : operation === 'first-frame' ? 'shot' : 'character', targetId: operation === 'parse' ? 'p' : operation === 'first-frame' ? 'q' : 'c', inputRevision: 1, idempotencyKey: 'request-0001',
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
  beforeEach(() => { enqueueJob.mockClear(); integrationCall.mockReset() })
  it('allows a new account to own and edit a workspace without granting sponsored spending', async () => {
    const r = seeded()
    const created = await invoke(r, 'createWorkspace', 'new-user', { name: 'New studio' })
    expect(created.success).toBe(true)
    const workspaceId = (created.data as Stored).recordId
    const projectResult = await invoke(r, 'createProject', 'new-user', { workspaceId, title: 'My project', script: 'My script' })
    expect(projectResult.success).toBe(true)
    const projectId = (projectResult.data as Stored).recordId
    for (const operation of ['parse', 'character', 'scene-anchor', 'voice', 'first-frame', 'h3', 'seedvr2', 'export']) {
      const result = await invoke(r, 'requestJob', 'new-user', { projectId, operation, targetId: projectId, expectedRevision: 1, idempotencyKey: 'spend-test-0001', userId: 'owner' })
      expect(result).toMatchObject({ success: false, code: 'spending_not_approved' })
    }
    for (const name of ['searchReferences', 'listVoices']) {
      expect(await invoke(r, name, 'new-user', { projectId })).toMatchObject({ success: false, code: 'spending_not_approved' })
    }
    expect(await invoke(r, 'getBillingAccess', 'new-user', {})).toMatchObject({ success: true, data: { approved: false } })
    expect(enqueueJob).not.toHaveBeenCalled()
    expect(integrationCall).not.toHaveBeenCalled()
    expect(r.tables.get('workflow-jobs')?.size ?? 0).toBe(0)
  })
  it('requires both spending approval and the workspace operation permission', async () => {
    const r = seeded()
    r.billingAllowedUserIds = ' reviewer , editor , outside '
    const params = { projectId: 'p', operation: 'parse', targetId: 'p', expectedRevision: 1, idempotencyKey: 'approval-0001' }
    for (const id of ['reviewer', 'editor', 'outside']) expect((await invoke(r, 'requestJob', id, params)).success).toBe(false)
    r.insert('memberships', 'approved', { workspaceId: 'w', userId: 'approved', role: 'owner', status: 'active' })
    expect((await invoke(r, 'requestJob', 'approved', params)).success).toBe(false)
    r.billingAllowedUserIds = 'approved'
    expect((await invoke(r, 'requestJob', 'approved', params)).success).toBe(true)
    expect(enqueueJob).toHaveBeenCalledTimes(1)
  })
  it('rejects duplicate or filesystem-unsafe storyboard identifiers', () => {
    const board = project().storyboard
    expect(validStoryboard(board)).toBe(true)
    expect(validStoryboard({ ...board, scenes: [{ ...board.scenes[0], id: '../outside' }] })).toBe(false)
    expect(validStoryboard({ ...board, characters: [{ ...board.characters[0], id: 'q' }] })).toBe(false)
    expect(validStoryboard({ ...board, scenes: [{ ...board.scenes[0], shots: [{ ...board.scenes[0].shots[0], shotType: 'front view' }] }] })).toBe(false)
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
  it('refuses shot execution while the private worker is disabled', async () => {
    const r = seeded()
    r.executionEnabled = false
    r.get('projects', 'p')!.data.currentAssets = { 'scene-anchor:s': 'anchor', 'character:c': 'character' }
    const result = await invoke(r, 'requestJob', 'owner', { projectId: 'p', expectedRevision: 1,
      operation: 'first-frame', targetId: 'q', idempotencyKey: 'shot-request-0001' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('not enabled')
    expect(r.tables.get('workflow-jobs')?.size ?? 0).toBe(0)
  })
  it('allows first-frame while the Vast GPU gate remains closed', async () => {
    const r = seeded()
    r.gpuEnabled = false
    r.get('projects', 'p')!.data.currentAssets = { 'scene-anchor:s': 'anchor', 'character:c': 'character' }
    r.insert('assets', 'anchor', { workspaceId: 'w', projectId: 'p', operation: 'scene-anchor', targetId: 's',
      storageKey: 'catalog/p/anchor.png', mimeType: 'image/png', sha256: 'a'.repeat(64), byteSize: 100 })
    r.insert('assets', 'character', { workspaceId: 'w', projectId: 'p', operation: 'character', targetId: 'c',
      storageKey: 'catalog/p/character.png', mimeType: 'image/png', sha256: 'b'.repeat(64), byteSize: 100 })
    const params = { projectId: 'p', expectedRevision: 1, targetId: 'q', idempotencyKey: 'shot-request-0002' }
    expect((await invoke(r, 'requestJob', 'owner', { ...params, operation: 'first-frame' })).success).toBe(true)
    const h3 = await invoke(r, 'requestJob', 'owner', { ...params, operation: 'h3', idempotencyKey: 'video-request-0002' })
    expect(h3.success).toBe(false)
    expect(h3.error).toContain('Vast GPU')
  })
  it('resumes saved paid media only for the owner and current revision', async () => {
    const r = seeded()
    const saved = job('character')
    saved.status = 'failed'
    saved.catalogAttempted = true
    saved.catalogResult = { asset: { storageKey: 'catalog/p/saved.png', mimeType: 'image/png', sha256: 'a'.repeat(64), byteSize: 100 } }
    r.insert('workflow-jobs', 'saved', { ...saved })
    enqueueJob.mockClear()
    expect((await invoke(r, 'resumeSavedJob', 'editor', { jobId: 'saved' })).success).toBe(false)
    expect((await invoke(r, 'resumeSavedJob', 'owner', { jobId: 'saved' })).success).toBe(true)
    expect(r.get('workflow-jobs', 'saved')?.data.status).toBe('queued')
    expect(enqueueJob).toHaveBeenCalledTimes(1)
    expect((await invoke(r, 'resumeSavedJob', 'owner', { jobId: 'saved' })).success).toBe(false)
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
    r.billingAllowedUserIds = 'reviewer';
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
  it('restricts Catalog research and voice discovery to owners and stores only reference metadata', async () => {
    const r = seeded()
    r.get('projects', 'p')!.data.title = 'Rain at the station'
    r.get('projects', 'p')!.data.description = 'A quiet arrival'
    expect((await invoke(r, 'searchReferences', 'viewer', { projectId: 'p' })).success).toBe(false)
    expect((await invoke(r, 'listVoices', 'editor', { projectId: 'p' })).success).toBe(false)
    integrationCall.mockResolvedValueOnce({ videos: [
      { title: 'Rainy station composition', links: { watch: 'https://www.youtube.com/watch?v=abc123' } },
      { title: 'Unsafe link', links: { watch: 'https://bad.example/video' } },
    ] })
    const references = await invoke(r, 'searchReferences', 'owner', { projectId: 'p' })
    expect(references.success).toBe(true)
    expect(integrationCall).toHaveBeenCalledWith('youtube/search-videos', expect.objectContaining({ maxResults: 3 }))
    expect((r.get('projects', 'p')?.data.referenceCandidates as unknown[]).length).toBe(1)
    await invoke(r, 'searchReferences', 'owner', { projectId: 'p' })
    expect(integrationCall).toHaveBeenCalledTimes(1)
    integrationCall.mockResolvedValueOnce({ voices: [{ voice_id: 'voice-123', name: 'Ari', preview_url: 'https://example.com/preview.mp3' }] })
    const voices = await invoke(r, 'listVoices', 'owner', { projectId: 'p' })
    expect(voices.success).toBe(true)
    expect(integrationCall).toHaveBeenCalledWith('elevenlabs/list-voices', {})
  })
  it('changes export email preference without invalidating an in-flight creative revision', async () => {
    const r = seeded()
    expect((await invoke(r, 'setExportNotification', 'viewer', { projectId: 'p', enabled: true })).success).toBe(false)
    expect((await invoke(r, 'setExportNotification', 'editor', { projectId: 'p', enabled: true })).success).toBe(false)
    expect((await invoke(r, 'setExportNotification', 'owner', { projectId: 'p', enabled: true })).success).toBe(true)
    expect(r.get('projects', 'p')?.data.notifyOnExport).toBe(true)
    expect(r.get('projects', 'p')?.data.revision).toBe(1)
  })
  it('keeps selected clips for trim edits but invalidates them for creative changes', async () => {
    const r = seeded()
    r.get('projects', 'p')!.data.currentAssets = { 'h3:q': 'video-a' }
    const trimBoard = project().storyboard
    trimBoard.scenes[0].shots[0].trimStartSeconds = 0.5
    expect((await invoke(r, 'saveProject', 'editor', { projectId: 'p', expectedRevision: 1, storyboard: trimBoard })).success).toBe(true)
    expect(r.get('projects', 'p')?.data.currentAssets).toEqual({ 'h3:q': 'video-a' })
    const changedBoard = structuredClone(trimBoard)
    changedBoard.scenes[0].shots[0].description = 'A different action'
    expect((await invoke(r, 'saveProject', 'editor', { projectId: 'p', expectedRevision: 2, storyboard: changedBoard })).success).toBe(true)
    expect(r.get('projects', 'p')?.data.currentAssets).toEqual({})
  })
})

describe('result publication', () => {
  beforeEach(() => { vi.restoreAllMocks(); enqueueJob.mockClear(); integrationCall.mockReset() })
  function privateResponse(status: 'succeeded' | 'failed' = 'succeeded', mime = 'image/png') {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'X-Content-Sha256': 'a'.repeat(64), 'Content-Length': '200' } })
      if (url.endsWith('/v1/jobs') || url.endsWith('/v1/jobs/remote')) return Response.json(url.endsWith('/v1/jobs') ? { id: 'remote' } :
        { id: 'remote', status, phase: status === 'succeeded' ? 'ready' : 'failed', startedAt: 100, finishedAt: 104, progress: 1, error: status === 'failed' ? 'provider failed' : undefined,
          result: { asset: { storageKey: mime === 'video/mp4' ? 'projects/p/jobs/output.mp4' : 'projects/p/jobs/output.png', mimeType: mime, sha256: 'a'.repeat(64), byteSize: 200 } } })
      throw new Error(url)
    }))
  }
  const context = { signal: new AbortController().signal, progress: vi.fn(), continue: vi.fn() }
  async function run(r: Records) { return runJob({ type: 'illustory-workflow', payload: { jobId: 'j' } } as never, context as never, r.env() as never) }
  it.each(['parse', 'character', 'scene-anchor', 'voice', 'first-frame', 'h3', 'seedvr2', 'export'] as const)('blocks queued %s after spending approval is revoked, before any provider call', async operation => {
    const r = seeded()
    r.insert('memberships', 'revoked', { workspaceId: 'w', userId: 'revoked', role: 'owner', status: 'active' })
    r.insert('workflow-jobs', 'j', { ...job(operation), requestedByUserId: 'revoked' })
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    await expect(run(r)).rejects.toThrow('require approval')
    expect(upstream).not.toHaveBeenCalled()
    expect(integrationCall).not.toHaveBeenCalled()
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('failed')
  })
  it('rechecks workspace membership before starting paid work', async () => {
    const r = seeded()
    r.get('memberships', 'owner')!.data.status = 'suspended'
    r.insert('workflow-jobs', 'j', { ...job('parse') })
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    await expect(run(r)).rejects.toThrow('Workspace permission was revoked')
    expect(upstream).not.toHaveBeenCalled()
  })
  it('finishes monitoring an already-submitted export after revocation without starting new work or email', async () => {
    privateResponse('succeeded', 'video/mp4')
    const r = seeded()
    r.emailFrom = 'studio@example.com'
    r.get('projects', 'p')!.data.notifyOnExport = true
    r.insert('workflow-jobs', 'j', { ...job('export'), targetType: 'project', targetId: 'p', providerJobId: 'remote', requestedByUserId: 'revoked' })
    await run(r)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
    expect(r.get('workflow-jobs', 'j')?.data.notificationStatus).toBe('failed')
    expect(integrationCall).not.toHaveBeenCalled()
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  })
  it('recovers a failed export using the same private job without rendering again', async () => {
    privateResponse('succeeded', 'video/mp4')
    const r = seeded()
    r.insert('workflow-jobs', 'j', { ...job('export'), status: 'failed', targetType: 'project', targetId: 'p', providerJobId: 'remote' })
    expect((await invoke(r, 'resumeSavedJob', 'viewer', { jobId: 'j' })).success).toBe(false)
    expect((await invoke(r, 'resumeSavedJob', 'owner', { jobId: 'j' })).success).toBe(true)
    await run(r)
    await run(r)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
    expect(r.tables.get('assets')?.size).toBe(1)
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  })
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
    expect(failed.get('workflow-jobs', 'j')?.data.error).toBe('provider failed')
    expect(failed.tables.get('assets')?.size ?? 0).toBe(0)
  })
  it('publishes one version and never republishes a duplicate or cancelled job', async () => {
    privateResponse()
    const r = seeded(); r.insert('workflow-jobs', 'j', { ...job() })
    await run(r)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
    expect(r.get('workflow-jobs', 'j')?.data.providerPhase).toBe('ready')
    expect(r.get('workflow-jobs', 'j')?.data.providerFinishedAt).toBe(104)
    expect(r.tables.get('assets')?.size).toBe(1)
    const current = (r.get('projects', 'p')?.data.currentAssets as Record<string,string>)['first-frame:q']
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
    const openAI = vi.fn().mockResolvedValueOnce(Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(characterReply) }] }] }))
      .mockResolvedValueOnce(Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(sceneReply) }] }] }))
    vi.stubGlobal('fetch', openAI)
    const r = seeded(); r.insert('workflow-jobs', 'j', { ...job('parse'), targetType: 'project', targetId: 'p' }); r.failNextJobSuccess = true
    r.get('projects', 'p')!.data.currentAssets = { 'character:c': 'old-image' }
    await expect(run(r)).rejects.toThrow('Simulated Worker interruption')
    expect(r.get('projects', 'p')?.data.revision).toBe(2)
    expect(r.get('projects', 'p')?.data.currentAssets).toEqual({})
    await run(r)
    expect(r.get('projects', 'p')?.data.revision).toBe(2)
    expect(r.get('workflow-jobs', 'j')?.data.outputVersion).toBe(2)
    expect(openAI).toHaveBeenCalledTimes(2)
    expect(JSON.parse(openAI.mock.calls[0][1].body)).toMatchObject({ model: 'gpt-5.5', max_output_tokens: 5000 })
    expect(JSON.parse(openAI.mock.calls[1][1].body)).toMatchObject({ model: 'gpt-5.6', max_output_tokens: 50000 })
  })
  it('publishes a catalog voice through private storage once', async () => {
    const data = btoa('a'.repeat(200))
    const media = `data:audio/mpeg;base64,${data}`
    integrationCall.mockResolvedValue({ audioUrl: media })
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const bytes = init.body as Uint8Array
        const digest = String((init.headers as Record<string, string>)['X-Content-Sha256'])
        return Response.json({ storageKey: 'catalog/p/j.mp3', mimeType: 'audio/mpeg', sha256: digest, byteSize: bytes.length })
      }
      if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'X-Content-Sha256': 'c2a908d98f5df987ade41b5fce213067efbcc21ef2240212a41e54b5e7c28ae5', 'Content-Length': '200' } })
      throw new Error('Unexpected private request')
    }))
    const r = seeded()
    const board = project().storyboard
    board.characters[0].voiceId = 'voice-123'
    r.insert('workflow-jobs', 'j', { ...job('voice'), request: { script: 'A room at dusk.', storyboard: board, options: { text: 'Ari speaks.' } } })
    await run(r)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
    expect((r.get('projects', 'p')?.data.currentAssets as Record<string, string>)['voice:c']).toBeTruthy()
    expect(integrationCall).toHaveBeenCalledTimes(1)
    await run(r)
    expect(integrationCall).toHaveBeenCalledTimes(1)
  })
  it('emails the active workspace owner once when a reviewer exports', async () => {
    privateResponse('succeeded', 'video/mp4')
    integrationCall.mockResolvedValue({ id: 'mail-1' })
    const r = seeded()
    r.billingAllowedUserIds = 'reviewer'
    r.emailFrom = 'studio@example.com'
    r.get('projects', 'p')!.data.notifyOnExport = true
    r.insert('users', 'owner', { email: 'owner@example.com' })
    r.insert('users', 'reviewer', { email: 'reviewer@example.com' })
    r.insert('workflow-jobs', 'j', { ...job('export'), targetType: 'project', targetId: 'p', requestedByUserId: 'reviewer' })
    await run(r)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
    expect(r.get('workflow-jobs', 'j')?.data.notificationStatus).toBe('sent')
    expect(integrationCall).toHaveBeenCalledWith('email/send', expect.objectContaining({ to: 'owner@example.com' }))
    await run(r)
    expect(integrationCall).toHaveBeenCalledTimes(1)
  })
  it('keeps the export but does not email a former owner', async () => {
    privateResponse('succeeded', 'video/mp4')
    const r = seeded()
    r.billingAllowedUserIds = 'reviewer'
    r.emailFrom = 'studio@example.com'
    r.get('projects', 'p')!.data.notifyOnExport = true
    r.get('memberships', 'owner')!.data.status = 'suspended'
    r.insert('users', 'owner', { email: 'owner@example.com' })
    r.insert('workflow-jobs', 'j', { ...job('export'), targetType: 'project', targetId: 'p', requestedByUserId: 'reviewer' })
    await run(r)
    expect(r.get('workflow-jobs', 'j')?.data.status).toBe('succeeded')
    expect(r.get('workflow-jobs', 'j')?.data.notificationStatus).toBe('failed')
    expect(integrationCall).not.toHaveBeenCalled()
  })
})
