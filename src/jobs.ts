import { buildCronContext, type Job, type JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import type { Asset, Project, Row, WorkflowJob } from './illustory/types'
import { assetSlot } from './illustory/types'
import { validStoryboard } from './illustory/validation'
import { getPrivateJob, submitPrivateJob, storeCatalogAsset, verifyPrivateAsset, type PrivateStatus } from './illustory/private-workflow'
import { chatText, characterImagePrompt, parseStoryboard, sceneImagePrompt, scriptMessages, SCRIPT_MODEL, voiceText } from './illustory/creative'
import { generateCatalogImage, generateCatalogVoice } from './illustory/catalog'

async function records<T>(env: Env, tool: string, params: Record<string, unknown>): Promise<T> {
  const room = env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))
  const response = await room.fetch(new Request('https://internal/api/tools/execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User-Id': env.OWNER_USER_ID, 'X-App-Action': 'true' },
    body: JSON.stringify({ tool, params }),
  }))
  const body = await response.json() as { success: boolean; data?: T; error?: string }
  if (!body.success || !body.data) throw new Error(body.error ?? `Record ${tool} failed`)
  return body.data
}
const get = async <T>(env: Env, collection: string, recordId: string) => (await records<{ record: Row<T> }>(env, 'records.get', { collection, recordId })).record
const update = async (env: Env, collection: string, recordId: string, data: Record<string, unknown>) => records(env, 'records.update', { collection, recordId, data })
const create = async (env: Env, collection: string, data: Record<string, unknown>, recordId?: string) => records<{ recordId: string }>(env, 'records.create', { collection, data, recordId })
const query = async <T>(env: Env, collection: string, where: Record<string, unknown>) => (await records<{ records: Row<T>[]; count: number }>(env, 'records.query', { collection, where, limit: 500 })).records

async function notifyExportReady(env: Env, jobId: string, work: WorkflowJob, project: Project): Promise<void> {
  if (work.operation !== 'export' || !project.notifyOnExport) return
  const current = await get<WorkflowJob>(env, 'workflow-jobs', jobId)
  if (current.data.notificationStatus && current.data.notificationStatus !== 'none') return
  if (!env.EMAIL_FROM) {
    await update(env, 'workflow-jobs', jobId, { notificationStatus: 'failed', notificationError: 'Email sender is not configured' })
    return
  }
  // Mark attempted before calling the provider. A crash may lose a notice,
  // but never retries an ambiguous send and mails the reviewer twice.
  await update(env, 'workflow-jobs', jobId, { notificationStatus: 'attempted' })
  try {
    const user = await get<{ email?: string }>(env, 'users', work.requestedByUserId)
    const email = user.data.email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Signed-in user has no usable email address')
    const catalog = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
    await catalog.integrations.call('email/send', { from: env.EMAIL_FROM, to: email,
      subject: 'Your Illustory export is ready',
      text: `The export for ${project.title} is ready. Sign in to https://${env.APP_NAME}.app.space/studio to review it.` })
    await update(env, 'workflow-jobs', jobId, { notificationStatus: 'sent', notificationError: '' })
  } catch (error) {
    await update(env, 'workflow-jobs', jobId, { notificationStatus: 'failed', notificationError: String(error).slice(0, 300) })
  }
}

async function handleWorkflow(job: Job, ctx: JobContext, env: Env): Promise<unknown> {
  const jobId = (job.payload as { jobId?: string }).jobId
  if (!jobId) throw new Error('Missing workflow job ID')
  const row = await get<WorkflowJob>(env, 'workflow-jobs', jobId)
  const work = row.data
  if (['cancelled', 'succeeded', 'stale'].includes(work.status)) return { status: work.status }
  if (ctx.signal.aborted) { await update(env, 'workflow-jobs', jobId, { status: 'cancelled' }); return { status: 'cancelled' } }
  try {
    let status: PrivateStatus
    if (['parse', 'character', 'scene-anchor', 'voice'].includes(work.operation)) {
      // Catalog endpoints do not accept an idempotency key. Persist intent
      // before billing; an ambiguous crash cannot silently bill again.
      if (work.catalogResult?.asset || work.catalogResult?.storyboard) {
        status = { id: jobId, status: 'succeeded', progress: 1, result: work.catalogResult }
      } else {
        if (work.catalogAttempted) throw new Error('Catalog result is ambiguous; start a new job only after checking provider usage')
        await update(env, 'workflow-jobs', jobId, { status: 'running', progress: 0.05, catalogAttempted: true })
        const catalog = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
        const call = (endpoint: string, params?: Record<string, unknown>) => catalog.integrations.call(endpoint, params ?? {})
        const script = work.request.script
        const board = work.request.storyboard
        if (work.operation === 'parse') {
          if (typeof script !== 'string' || !script.trim() || script.length > 20_000) throw new Error('Script must contain 1–20,000 characters for parsing')
          const raw = await call('openai/chat-completion', { model: SCRIPT_MODEL, max_tokens: 4000, messages: scriptMessages(script) })
          status = { id: jobId, status: 'succeeded', progress: 1, result: { storyboard: parseStoryboard(chatText(raw)) } }
        } else {
          if (!validStoryboard(board)) throw new Error('Invalid frozen storyboard')
          let media: string
          if (work.operation === 'character' || work.operation === 'voice') {
            const character = board.characters.find(c => c.id === work.targetId)
            if (!character) throw new Error('Character no longer exists in the frozen storyboard')
            if (work.operation === 'character') media = await generateCatalogImage(call, characterImagePrompt(character), ctx.signal)
            else {
              const options = work.request.options && typeof work.request.options === 'object' ? work.request.options as Record<string, unknown> : {}
              const line = typeof options.text === 'string' ? options.text.trim() : voiceText(board, character)
              if (!character.voiceId || !line || line.length > 240) throw new Error('Select an ElevenLabs voice and provide up to 240 characters of dialogue')
              media = await generateCatalogVoice(call, character.voiceId, line)
            }
          } else {
            const scene = board.scenes.find(s => s.id === work.targetId)
            if (!scene) throw new Error('Scene no longer exists in the frozen storyboard')
            media = await generateCatalogImage(call, sceneImagePrompt(scene), ctx.signal)
          }
          const asset = await storeCatalogAsset(env, jobId, work.projectId, media, ctx.signal)
          status = { id: jobId, status: 'succeeded', progress: 1, result: { asset } }
        }
        await update(env, 'workflow-jobs', jobId, { catalogResult: status.result })
      }
    } else {
      let providerJobId = work.providerJobId
      if (!providerJobId) {
        // The private service owns idempotency. A restart between POST and this
        // update repeats POST with the same key and must return the same ID.
        providerJobId = await submitPrivateJob(env, jobId, work, ctx.signal)
        await update(env, 'workflow-jobs', jobId, { providerJobId, status: 'running', progress: 0.02 })
      }
      status = await getPrivateJob(env, providerJobId, ctx.signal)
    }
    const fresh = await get<WorkflowJob>(env, 'workflow-jobs', jobId)
    if (fresh.data.status === 'cancelled' || ctx.signal.aborted) return { status: 'cancelled' }
    if (status.status === 'failed' || status.status === 'cancelled') {
      await update(env, 'workflow-jobs', jobId, { status: 'failed', error: status.error?.slice(0, 500) ?? `Private job ${status.status}` })
      throw new Error(`Private job ${status.status}`)
    }
    if (status.status !== 'succeeded') {
      const progress = Math.min(0.99, Math.max(0, Number(status.progress) || 0))
      await update(env, 'workflow-jobs', jobId, { status: 'running', progress })
      ctx.progress(progress, status.status)
      ctx.continue({ providerJobId: status.id }, { afterMs: 2500 })
      return
    }
    const project = await get<Project>(env, 'projects', work.projectId)
    if (work.operation === 'parse' && project.data.lastParseJobId === jobId) {
      await update(env, 'workflow-jobs', jobId, { status: 'succeeded', progress: 1, outputVersion: project.data.lastParseRevision, error: '' })
      return { status: 'succeeded', outputVersion: project.data.lastParseRevision }
    }
    const priorAsset = work.operation === 'parse' ? undefined : (await query<Asset>(env, 'assets', { createdByJobId: jobId })).find(a => a.data.projectId === work.projectId)
    if (priorAsset && project.data.currentAssets[assetSlot(work.operation, work.targetId)] === priorAsset.recordId) {
      await update(env, 'workflow-jobs', jobId, { status: 'succeeded', progress: 1, outputAssetId: priorAsset.recordId, outputVersion: priorAsset.data.version, error: '' })
      await notifyExportReady(env, jobId, work, project.data)
      return { status: 'succeeded', outputAssetId: priorAsset.recordId, outputVersion: priorAsset.data.version }
    }
    if (project.data.workspaceId !== work.workspaceId || project.data.revision !== work.inputRevision) {
      await update(env, 'workflow-jobs', jobId, { status: 'stale', progress: 1, error: 'Input revision is no longer current' })
      return { status: 'stale' }
    }
    if (work.operation === 'parse') {
      const board = status.result?.storyboard
      if (!validStoryboard(board)) throw new Error('Parser returned no valid storyboard')
      const nextRevision = project.data.revision + 1
      await update(env, 'projects', work.projectId, { storyboard: board, currentAssets: {}, revision: nextRevision, lastParseJobId: jobId, lastParseRevision: nextRevision })
      await update(env, 'workflow-jobs', jobId, { status: 'succeeded', progress: 1, outputVersion: nextRevision, error: '' })
      return { status: 'succeeded', outputVersion: nextRevision }
    }
    const binary = status.result?.asset
    const expectedMime = work.operation === 'voice' ? ['audio/mpeg']
      : ['h3', 'seedvr2', 'export'].includes(work.operation) ? ['video/mp4'] : ['image/png', 'image/jpeg']
    if (!binary || !binary.storageKey || !/^[a-f0-9]{64}$/i.test(binary.sha256) || !Number.isSafeInteger(binary.byteSize) || binary.byteSize <= 0
      || !expectedMime.includes(binary.mimeType)) throw new Error('Media service returned invalid asset metadata')
    await verifyPrivateAsset(env, binary, ctx.signal)
    let assetId = priorAsset?.recordId
    let version = priorAsset?.data.version
    if (!priorAsset) {
      const versions = await query<Asset>(env, 'assets', { projectId: work.projectId, operation: work.operation, targetId: work.targetId })
      version = Math.max(0, ...versions.map(v => v.data.version)) + 1
      const asset: Asset = { workspaceId: work.workspaceId, projectId: work.projectId, operation: work.operation, targetType: work.targetType,
        targetId: work.targetId, version, inputRevision: work.inputRevision, storageKey: binary.storageKey, mimeType: binary.mimeType,
        sha256: binary.sha256, byteSize: binary.byteSize, createdByJobId: jobId, createdByUserId: work.requestedByUserId }
      assetId = (await create(env, 'assets', { ...asset })).recordId
    }
    const again = await get<Project>(env, 'projects', work.projectId)
    const cancelled = await get<WorkflowJob>(env, 'workflow-jobs', jobId)
    if (again.data.revision !== work.inputRevision || cancelled.data.status === 'cancelled') {
      await update(env, 'workflow-jobs', jobId, { status: cancelled.data.status === 'cancelled' ? 'cancelled' : 'stale', progress: 1, outputAssetId: assetId, outputVersion: version, error: 'Result was not published because input changed or job was cancelled' })
      return { status: 'stale' }
    }
    const currentAssets = { ...again.data.currentAssets, [assetSlot(work.operation, work.targetId)]: assetId }
    await update(env, 'projects', work.projectId, { currentAssets })
    await update(env, 'workflow-jobs', jobId, { status: 'succeeded', progress: 1, outputAssetId: assetId, outputVersion: version, error: '' })
    await notifyExportReady(env, jobId, work, again.data)
    ctx.progress(1, 'ready')
    return { status: 'succeeded', outputAssetId: assetId, outputVersion: version }
  } catch (error) {
    const latest = await get<WorkflowJob>(env, 'workflow-jobs', jobId)
    if (latest.data.status !== 'cancelled') await update(env, 'workflow-jobs', jobId, { status: 'failed', error: String(error).slice(0, 500) })
    throw error
  }
}

export async function runJob(job: Job, ctx: JobContext, env: Env): Promise<unknown> {
  if (job.type !== 'illustory-workflow') throw new Error(`Unknown job type: ${job.type}`)
  return handleWorkflow(job, ctx, env)
}
