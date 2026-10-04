import type { Env } from '../../worker'
import type { WorkflowJob, Storyboard } from './types'

export interface PrivateResult {
  storyboard?: Storyboard
  asset?: { storageKey: string; mimeType: string; sha256: string; byteSize: number }
}
export interface PrivateStatus { id: string; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; progress: number; error?: string; result?: PrivateResult }

function config(env: Env) {
  if (!env.PRIVATE_WORKFLOW_URL || !env.PRIVATE_WORKFLOW_TOKEN) throw new Error('Private workflow service is not configured')
  const url = new URL(env.PRIVATE_WORKFLOW_URL)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') throw new Error('Private workflow URL must use HTTPS')
  return { root: url.toString().replace(/\/$/, ''), token: env.PRIVATE_WORKFLOW_TOKEN }
}
async function request(env: Env, path: string, init: RequestInit): Promise<Response> {
  const { root, token } = config(env)
  const response = await fetch(`${root}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`Private workflow service returned HTTP ${response.status}`)
  return response
}
export async function submitPrivateJob(env: Env, jobId: string, job: WorkflowJob, signal: AbortSignal): Promise<string> {
  const response = await request(env, '/v1/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': job.idempotencyKey },
    body: JSON.stringify({ id: jobId, workspaceId: job.workspaceId, projectId: job.projectId, operation: job.operation,
      targetType: job.targetType, targetId: job.targetId, inputRevision: job.inputRevision, input: job.request }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
  })
  const body = await response.json() as { id?: string }
  if (!body.id || typeof body.id !== 'string') throw new Error('Private workflow returned no job ID')
  return body.id
}
export async function getPrivateJob(env: Env, providerJobId: string, signal: AbortSignal): Promise<PrivateStatus> {
  const response = await request(env, `/v1/jobs/${encodeURIComponent(providerJobId)}`, { method: 'GET', signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) })
  const body = await response.json() as PrivateStatus
  if (!body || body.id !== providerJobId || !['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(body.status)) throw new Error('Private workflow returned an invalid status')
  return body
}
export async function cancelPrivateJob(env: Env, providerJobId: string): Promise<void> {
  await request(env, `/v1/jobs/${encodeURIComponent(providerJobId)}`, { method: 'DELETE' })
}
export async function fetchPrivateAsset(env: Env, storageKey: string, signal?: AbortSignal, range?: string): Promise<Response> {
  return request(env, `/v1/assets/${encodeURIComponent(storageKey)}`, { method: 'GET', signal, headers: range ? { Range: range } : undefined })
}
export async function verifyPrivateAsset(env: Env, asset: { storageKey: string; sha256: string; byteSize: number }, signal: AbortSignal): Promise<void> {
  const response = await request(env, `/v1/assets/${encodeURIComponent(asset.storageKey)}`, { method: 'HEAD', signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) })
  if (response.headers.get('X-Content-Sha256')?.toLowerCase() !== asset.sha256.toLowerCase()
    || Number(response.headers.get('Content-Length')) !== asset.byteSize) throw new Error('Private asset integrity check failed')
}
