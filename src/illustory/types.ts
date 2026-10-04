export type WorkspaceRole = 'owner' | 'editor' | 'reviewer' | 'viewer'
export type Operation = 'parse' | 'character' | 'scene-anchor' | 'first-frame' | 'h3' | 'seedvr2' | 'export'
export type TargetType = 'project' | 'character' | 'scene' | 'shot'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'stale'

export interface Character { id: string; name: string; description: string }
export interface Shot { id: string; title: string; description: string; durationSeconds: number; trimStartSeconds?: number; trimEndSeconds?: number }
export interface Scene { id: string; title: string; description: string; shots: Shot[] }
export interface Storyboard { characters: Character[]; scenes: Scene[] }
export interface Workspace { [key: string]: unknown; name: string; ownerId: string }
export interface Membership { [key: string]: unknown; workspaceId: string; userId: string; role: WorkspaceRole; status: 'active' | 'suspended' }
export interface Project {
  [key: string]: unknown
  workspaceId: string
  title: string
  script: string
  revision: number
  storyboard: Storyboard
  currentAssets: Record<string, string>
  lastParseJobId: string
  lastParseRevision: number
  createdByUserId: string
}
export interface Asset {
  [key: string]: unknown
  workspaceId: string
  projectId: string
  operation: Operation
  targetType: TargetType
  targetId: string
  version: number
  inputRevision: number
  storageKey: string
  mimeType: string
  sha256: string
  byteSize: number
  createdByJobId: string
  createdByUserId: string
}
export interface WorkflowJob {
  [key: string]: unknown
  workspaceId: string
  projectId: string
  operation: Operation
  targetType: TargetType
  targetId: string
  inputRevision: number
  idempotencyKey: string
  status: JobStatus
  progress: number
  providerJobId: string
  outputAssetId: string
  outputVersion: number
  error: string
  requestedByUserId: string
  request: Record<string, unknown>
}
export type Row<T> = { recordId: string; data: T; createdAt?: string; updatedAt?: string }

export const emptyStoryboard = (): Storyboard => ({ characters: [], scenes: [] })
export const assetSlot = (operation: Operation, targetId: string) => `${operation}:${targetId}`
