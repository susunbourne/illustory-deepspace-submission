import { enqueueJob } from 'deepspace/worker'
import type { ActionContext, ActionHandler, ActionResult, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { assetSlot, emptyStoryboard } from '../illustory/types'
import { validStoryboard } from '../illustory/validation'
import { cancelPrivateJob } from '../illustory/private-workflow'
import { voiceChoices, youtubeReferences } from '../illustory/catalog'
import type { Asset, Membership, Operation, Project, Row, Storyboard, TargetType, WorkflowJob, Workspace, WorkspaceRole } from '../illustory/types'

const fail = (error: string, code = 'invalid_request'): ActionResult => ({ success: false, error, code })
const ok = <T>(data: T): ActionResult<T> => ({ success: true, data })
const str = (value: unknown, max = 5000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max ? value.trim() : null
const roles: WorkspaceRole[] = ['owner', 'editor', 'reviewer', 'viewer']
const operations: Operation[] = ['parse', 'character', 'scene-anchor', 'voice', 'first-frame', 'h3', 'seedvr2', 'export']
const targetFor: Record<Operation, TargetType> = { parse: 'project', character: 'character', 'scene-anchor': 'scene', voice: 'character', 'first-frame': 'shot', h3: 'shot', seedvr2: 'shot', export: 'project' }
const catalogOperations: Operation[] = ['parse', 'character', 'scene-anchor', 'voice']
const productionPlan = (board: Storyboard) => JSON.stringify({ title: board.title, chapter: board.chapter, characters: board.characters, scenes: board.scenes.map(s => ({
  ...s, shots: s.shots.map(({ trimStartSeconds: _start, trimEndSeconds: _end, ...shot }) => shot),
})) })

async function stableJobId(projectId: string, key: string): Promise<string> {
  const input = new TextEncoder().encode(`${projectId.length}:${projectId}${key}`)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input))
  const hex = [...digest.slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function member(tools: ActionTools, workspaceId: string, userId: string): Promise<Row<Membership> | null> {
  const r = await tools.query<Membership>('memberships', { where: { workspaceId, userId }, limit: 10 })
  if (!r.success) throw new Error(r.error)
  return (r.data.records as Row<Membership>[]).find(x => x.data.status === 'active') ?? null
}
async function workspaceAccess(ctx: ActionContext<Env>, workspaceId: string, allowed?: WorkspaceRole[]) {
  const m = await member(ctx.tools, workspaceId, ctx.userId)
  return m && (!allowed || allowed.includes(m.data.role)) ? m : null
}
async function projectAccess(ctx: ActionContext<Env>, projectId: string, allowed?: WorkspaceRole[]): Promise<Row<Project> | null> {
  const r = await ctx.tools.get<Project>('projects', projectId)
  if (!r.success) return null
  const p = r.data.record as Row<Project>
  return await workspaceAccess(ctx, p.data.workspaceId, allowed) ? p : null
}
const listWorkspaces: ActionHandler<Env> = async ({ tools, userId }) => {
  const r = await tools.query<Membership>('memberships', { where: { userId }, limit: 100 })
  if (!r.success) return r
  const items = []
  for (const m of r.data.records as Row<Membership>[]) {
    if (m.data.status !== 'active') continue
    const w = await tools.get<Workspace>('workspaces', m.data.workspaceId)
    if (w.success) items.push({ ...w.data.record, role: m.data.role })
  }
  return ok(items)
}
const createWorkspace: ActionHandler<Env> = async ({ params, tools, userId }) => {
  const name = str(params.name, 120)
  if (!name) return fail('Workspace name is required')
  const id = crypto.randomUUID()
  const w = await tools.create('workspaces', { name, ownerId: userId }, id)
  if (!w.success) return w
  const m = await tools.create('memberships', { workspaceId: id, userId, role: 'owner', status: 'active' })
  if (!m.success) { await tools.remove('workspaces', id); return m }
  return ok({ recordId: id, data: { name, ownerId: userId }, role: 'owner' })
}
const listMembers: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.workspaceId, 100)
  if (!id || !await workspaceAccess(ctx, id)) return fail('Workspace access denied', 'forbidden')
  return ctx.tools.query<Membership>('memberships', { where: { workspaceId: id }, limit: 100 })
}
const setMemberRole: ActionHandler<Env> = async ctx => {
  const workspaceId = str(ctx.params.workspaceId, 100), userId = str(ctx.params.userId, 200), role = ctx.params.role
  if (!workspaceId || !userId || !roles.includes(role as WorkspaceRole)) return fail('Invalid membership')
  if (!await workspaceAccess(ctx, workspaceId, ['owner'])) return fail('Owner required', 'forbidden')
  const knownUser = await ctx.tools.get('users', userId)
  if (!knownUser.success) return fail('User must sign in to this app before membership can be granted')
  const matches = await ctx.tools.query<Membership>('memberships', { where: { workspaceId, userId }, limit: 10 })
  if (!matches.success) return matches
  const existing = matches.data.records[0] as Row<Membership> | undefined
  if (existing?.data.role === 'owner' && existing.data.status === 'active' && role !== 'owner') {
    const all = await ctx.tools.query<Membership>('memberships', { where: { workspaceId, role: 'owner', status: 'active' }, limit: 100 })
    if (!all.success) return all
    if (all.data.count <= 1) return fail('Workspace must retain an owner')
  }
  return existing ? ctx.tools.update('memberships', existing.recordId, { role, status: 'active' }) : ctx.tools.create('memberships', { workspaceId, userId, role, status: 'active' })
}
const listProjects: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.workspaceId, 100)
  if (!id || !await workspaceAccess(ctx, id)) return fail('Workspace access denied', 'forbidden')
  return ctx.tools.query<Project>('projects', { where: { workspaceId: id }, limit: 100 })
}
const createProject: ActionHandler<Env> = async ctx => {
  const workspaceId = str(ctx.params.workspaceId, 100), title = str(ctx.params.title, 150), script = str(ctx.params.script, 20_000)
  const description = typeof ctx.params.description === 'string' ? ctx.params.description.trim().slice(0, 2000) : ''
  if (!workspaceId || !title || !script) return fail('Title and script are required')
  if (!await workspaceAccess(ctx, workspaceId, ['owner', 'editor'])) return fail('Edit permission required', 'forbidden')
  const data: Project = { workspaceId, title, description, script, revision: 1, storyboard: emptyStoryboard(), currentAssets: {}, lastParseJobId: '', lastParseRevision: 0, notifyOnExport: false, referenceCandidates: [], referenceQuery: '', createdByUserId: ctx.userId }
  const r = await ctx.tools.create('projects', { ...data })
  return r.success ? ok({ recordId: r.data.recordId, data }) : r
}
const getProject: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.projectId, 100)
  const p = id && await projectAccess(ctx, id)
  return p ? ok(p) : fail('Project access denied', 'forbidden')
}
const saveProject: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.projectId, 100)
  const p = id && await projectAccess(ctx, id, ['owner', 'editor'])
  if (!p) return fail('Edit permission required', 'forbidden')
  if (ctx.params.expectedRevision !== p.data.revision) return fail('Project changed; reload before saving', 'revision_conflict')
  const patch: Partial<Project> = { revision: p.data.revision + 1 }
  if ('title' in ctx.params) { const v = str(ctx.params.title, 150); if (!v) return fail('Invalid title'); patch.title = v }
  if ('description' in ctx.params) { if (typeof ctx.params.description !== 'string' || ctx.params.description.length > 2000) return fail('Invalid description'); patch.description = ctx.params.description.trim() }
  if ('script' in ctx.params) { const v = str(ctx.params.script, 20_000); if (!v) return fail('Script must contain 1–20,000 characters'); patch.script = v }
  if ('storyboard' in ctx.params) { if (!validStoryboard(ctx.params.storyboard)) return fail('Invalid storyboard'); patch.storyboard = ctx.params.storyboard }
  if ((patch.script !== undefined && patch.script !== p.data.script)
    || (patch.storyboard !== undefined && productionPlan(patch.storyboard) !== productionPlan(p.data.storyboard))) patch.currentAssets = {}
  if ((patch.title !== undefined && patch.title !== p.data.title) || (patch.description !== undefined && patch.description !== p.data.description)) {
    patch.referenceCandidates = []
    patch.referenceQuery = ''
  }
  const r = await ctx.tools.update('projects', p.recordId, { ...patch })
  return r.success ? ok({ recordId: p.recordId, data: { ...p.data, ...patch } }) : r
}
const setExportNotification: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.projectId, 100)
  const p = id && await projectAccess(ctx, id, ['owner'])
  if (!p) return fail('Owner required to change export notifications', 'forbidden')
  if (typeof ctx.params.enabled !== 'boolean') return fail('Invalid notification setting')
  const r = await ctx.tools.update('projects', p.recordId, { notifyOnExport: ctx.params.enabled })
  return r.success ? ok({ recordId: p.recordId, data: { ...p.data, notifyOnExport: ctx.params.enabled } }) : r
}
const listAssets: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.projectId, 100)
  if (!id || !await projectAccess(ctx, id)) return fail('Project access denied', 'forbidden')
  return ctx.tools.query<Asset>('assets', { where: { projectId: id }, limit: 200 })
}
const listJobs: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.projectId, 100)
  if (!id || !await projectAccess(ctx, id)) return fail('Project access denied', 'forbidden')
  return ctx.tools.query<WorkflowJob>('workflow-jobs', { where: { projectId: id }, limit: 100 })
}
const listVoices: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.projectId, 100)
  if (!id || !await projectAccess(ctx, id, ['owner'])) return fail('Owner required to list billable voices', 'forbidden')
  const result = await ctx.tools.integration('elevenlabs/list-voices', {})
  if (!result.success) return fail(result.error, 'integration_failed')
  try { return ok(voiceChoices(result.data)) } catch (error) { return fail(String(error), 'provider_response_invalid') }
}
const searchReferences: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.projectId, 100)
  const p = id && await projectAccess(ctx, id, ['owner'])
  if (!p) return fail('Owner required to search references', 'forbidden')
  const q = `${p.data.title} ${p.data.description ?? ''} cinematic visual reference`.trim().slice(0, 250)
  if (p.data.referenceQuery === q) return ok(p.data.referenceCandidates ?? [])
  const result = await ctx.tools.integration('youtube/search-videos', { q, maxResults: 3 })
  if (!result.success) return fail(result.error, 'integration_failed')
  try {
    const references = youtubeReferences(result.data)
    const saved = await ctx.tools.update('projects', p.recordId, { referenceCandidates: references, referenceQuery: q })
    return saved.success ? ok(references) : saved
  } catch (error) { return fail(String(error), 'provider_response_invalid') }
}
const requestJob: ActionHandler<Env> = async ctx => {
  const projectId = str(ctx.params.projectId, 100), operation = ctx.params.operation as Operation
  const targetId = str(ctx.params.targetId, 150), idempotencyKey = str(ctx.params.idempotencyKey, 200)
  if (!projectId || !operations.includes(operation) || !targetId || !idempotencyKey || idempotencyKey.length < 8) return fail('Invalid job request')
  const p = await projectAccess(ctx, projectId, operation === 'export' ? ['owner', 'reviewer'] : ['owner'])
  if (!p) return fail(operation === 'export' ? 'Review permission required for export' : 'Owner approval required for billable work', 'forbidden')
  if (ctx.params.expectedRevision !== p.data.revision) return fail('Project changed; reload before generating', 'revision_conflict')
  if (operation === 'parse' && p.data.script.length > 20_000) return fail('Script must be at most 20,000 characters for this parser')
  if (operation !== 'parse' && (!ctx.env.PRIVATE_WORKFLOW_URL || !ctx.env.PRIVATE_WORKFLOW_TOKEN)) return fail('Private media service is not configured', 'service_unavailable')
  if (['first-frame', 'h3', 'seedvr2', 'export'].includes(operation) && ctx.env.PRIVATE_WORKFLOW_EXECUTION_ENABLED !== '1')
    return fail('Private shot execution is not enabled yet. Connect and verify the Azure/Vast worker before starting this job.', 'service_unavailable')
  const targetType = targetFor[operation]
  if ((targetType === 'project' && targetId !== projectId) || (targetType === 'character' && !p.data.storyboard.characters.some(c => c.id === targetId))
    || (targetType === 'scene' && !p.data.storyboard.scenes.some(s => s.id === targetId))
    || (targetType === 'shot' && !p.data.storyboard.scenes.some(s => s.shots.some(q => q.id === targetId)))) return fail('Target does not exist')
  if (operation === 'first-frame') {
    const scene = p.data.storyboard.scenes.find(s => s.shots.some(q => q.id === targetId))
    if (!scene || !p.data.currentAssets[assetSlot('scene-anchor', scene.id)]) return fail('Select a scene anchor before generating a first frame')
    const shot = scene.shots.find(q => q.id === targetId)!
    const missing = p.data.storyboard.characters.filter(c => ((shot.characters?.includes(c.id)) || shot.description.includes(c.name)) && !p.data.currentAssets[assetSlot('character', c.id)])
    if (missing.length) return fail(`Generate character references first: ${missing.map(c => c.name).join(', ')}`)
  }
  if (operation === 'h3' && !p.data.currentAssets[assetSlot('first-frame', targetId)]) return fail('Select a first frame before H3')
  if (operation === 'seedvr2' && !p.data.currentAssets[assetSlot('h3', targetId)]) return fail('Select H3 video before enhancement')
  if (operation === 'export' && !p.data.storyboard.scenes.some(s => s.shots.some(q => p.data.currentAssets[assetSlot('h3', q.id)] || p.data.currentAssets[assetSlot('seedvr2', q.id)]))) return fail('Generate at least one video before export')
  if (operation === 'voice') {
    const character = p.data.storyboard.characters.find(c => c.id === targetId)
    const options = ctx.params.options && typeof ctx.params.options === 'object' ? ctx.params.options as Record<string, unknown> : {}
    if (!character?.voiceId || typeof options.text !== 'string' || !options.text.trim() || options.text.length > 240) return fail('Choose a voice and provide 1–240 characters of dialogue for one short shot')
  }
  const prior = await ctx.tools.query<WorkflowJob>('workflow-jobs', { where: { projectId, idempotencyKey }, limit: 2 })
  if (!prior.success) return prior
  if (prior.data.records.length) {
    const existing = prior.data.records[0]
    if (existing.data.operation !== operation || existing.data.targetId !== targetId || existing.data.inputRevision !== p.data.revision) return fail('Idempotency key reused for different input', 'idempotency_conflict')
    return ok(existing)
  }
  const active = await ctx.tools.query<WorkflowJob>('workflow-jobs', { where: { projectId, operation, targetId }, limit: 100 })
  if (!active.success) return active
  const running = active.data.records.find(j => j.data.inputRevision === p.data.revision && ['queued', 'running'].includes(j.data.status))
  if (running) return ok(running)
  const inputAssets: Record<string, { storageKey: string; mimeType: string; sha256: string; byteSize: number }> = {}
  for (const [slot, assetId] of Object.entries(p.data.currentAssets)) {
    const asset = await ctx.tools.get<Asset>('assets', assetId)
    if (!asset.success || asset.data.record.data.projectId !== projectId) return fail('Selected asset is unavailable')
    const a = asset.data.record.data
    inputAssets[slot] = { storageKey: a.storageKey, mimeType: a.mimeType, sha256: a.sha256, byteSize: a.byteSize }
  }
  // A stable record ID makes concurrent requests with the same key contend
  // for one durable row. The private adapter enforces the paid-work boundary.
  const jobId = await stableJobId(projectId, idempotencyKey)
  const job: WorkflowJob = { workspaceId: p.data.workspaceId, projectId, operation, targetType, targetId, inputRevision: p.data.revision,
    idempotencyKey, status: 'queued', progress: 0, providerJobId: '', outputAssetId: '', outputVersion: 0, error: '', requestedByUserId: ctx.userId,
    catalogAttempted: false, catalogResult: {}, notificationStatus: 'none', notificationError: '',
    request: { script: p.data.script, storyboard: p.data.storyboard, parseJobId: p.data.lastParseJobId, inputAssets, options: ctx.params.options ?? {} } }
  const created = await ctx.tools.create('workflow-jobs', { ...job }, jobId)
  if (!created.success) {
    const raced = await ctx.tools.get<WorkflowJob>('workflow-jobs', jobId)
    if (raced.success) {
      const existing = raced.data.record as Row<WorkflowJob>
      if (existing.data.projectId === projectId && existing.data.idempotencyKey === idempotencyKey && existing.data.operation === operation
        && existing.data.targetId === targetId && existing.data.inputRevision === p.data.revision) return ok(existing)
    }
    return created
  }
  try { await enqueueJob(ctx.env.JOB_ROOMS, `app:${ctx.env.DEEPSPACE_APP_ID}`, 'illustory-workflow', { jobId }, { maxAttempts: catalogOperations.includes(operation) ? 1 : 2, enqueuedBy: ctx.userId }) }
  catch { await ctx.tools.update('workflow-jobs', jobId, { status: 'failed', error: 'Queue unavailable' }); return fail('Could not enqueue job', 'queue_failed') }
  return ok({ recordId: jobId, data: job })
}
const cancelJob: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.jobId, 100)
  if (!id) return fail('Job ID required')
  const r = await ctx.tools.get<WorkflowJob>('workflow-jobs', id)
  if (!r.success) return fail('Job not found')
  const job = r.data.record as Row<WorkflowJob>
  if (!await workspaceAccess(ctx, job.data.workspaceId, ['owner'])) return fail('Owner required', 'forbidden')
  if (['succeeded', 'failed', 'cancelled', 'stale'].includes(job.data.status)) return fail('Job is terminal')
  const cancelled = await ctx.tools.update('workflow-jobs', id, { status: 'cancelled' })
  if (cancelled.success && job.data.providerJobId && !catalogOperations.includes(job.data.operation)) {
    try { await cancelPrivateJob(ctx.env, job.data.providerJobId) } catch { /* local cancellation still prevents publication */ }
  }
  return cancelled
}
const resumeSavedJob: ActionHandler<Env> = async ctx => {
  const id = str(ctx.params.jobId, 100)
  if (!id) return fail('Job ID required')
  const found = await ctx.tools.get<WorkflowJob>('workflow-jobs', id)
  if (!found.success) return fail('Job not found')
  const job = found.data.record as Row<WorkflowJob>
  if (!await workspaceAccess(ctx, job.data.workspaceId, ['owner'])) return fail('Owner required', 'forbidden')
  if (job.data.status !== 'failed' || !['character', 'scene-anchor', 'voice'].includes(job.data.operation)
    || !job.data.catalogResult?.asset) return fail('No saved media result can be resumed')
  const project = await ctx.tools.get<Project>('projects', job.data.projectId)
  if (!project.success || project.data.record.data.workspaceId !== job.data.workspaceId
    || project.data.record.data.revision !== job.data.inputRevision) return fail('The input revision has changed; saved media cannot be published')
  const queued = await ctx.tools.update('workflow-jobs', id, { status: 'queued', progress: 0.95, error: '' })
  if (!queued.success) return queued
  try {
    await enqueueJob(ctx.env.JOB_ROOMS, `app:${ctx.env.DEEPSPACE_APP_ID}`, 'illustory-workflow', { jobId: id }, { maxAttempts: 1, enqueuedBy: ctx.userId })
  } catch {
    await ctx.tools.update('workflow-jobs', id, { status: 'failed', error: 'Queue unavailable; saved media remains available for another resume' })
    return fail('Could not resume saved media', 'queue_failed')
  }
  return ok({ jobId: id, status: 'queued' })
}
const selectAsset: ActionHandler<Env> = async ctx => {
  const projectId = str(ctx.params.projectId, 100), assetId = str(ctx.params.assetId, 100)
  if (!projectId || !assetId) return fail('Project and asset required')
  const p = await projectAccess(ctx, projectId, ['owner', 'reviewer'])
  if (!p) return fail('Review permission required', 'forbidden')
  const r = await ctx.tools.get<Asset>('assets', assetId)
  if (!r.success || r.data.record.data.projectId !== projectId) return fail('Asset not found')
  const a = r.data.record.data
  const currentAssets = { ...p.data.currentAssets, [assetSlot(a.operation, a.targetId)]: assetId }
  const saved = await ctx.tools.update('projects', projectId, { currentAssets, revision: p.data.revision + 1 })
  return saved.success ? ok({ currentAssets, revision: p.data.revision + 1 }) : saved
}

export const actions: Record<string, ActionHandler<Env>> = { listWorkspaces, createWorkspace, listMembers, setMemberRole, listProjects, createProject, getProject, saveProject, setExportNotification, listAssets, listJobs, listVoices, searchReferences, requestJob, cancelJob, resumeSavedJob, selectAsset }
