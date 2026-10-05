export type WorkspaceRole = 'owner' | 'editor' | 'reviewer' | 'viewer'
export type Operation = 'parse' | 'character' | 'scene-anchor' | 'voice' | 'first-frame' | 'h3' | 'seedvr2' | 'export'
export type TargetType = 'project' | 'character' | 'scene' | 'shot'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'stale'

export interface Character {
  id: string; name: string; description: string; nameEn?: string; personality?: string
  appearance?: Record<string, string>; voiceId?: string; referenceImagePath?: string; loraUrl?: string
}
export interface Beat { id: string; description: string; durationSeconds: number; speaker?: string; dialogue?: string }
export interface CharacterEmotion { characterId: string; emotion: 'tense' | 'melancholy' | 'fearful' | 'determined' | 'neutral' }
export interface Shot {
  id: string; title: string; description: string; durationSeconds: number
  characters?: string[]; shotType?: string; cameraAngle?: string; timeOfDay?: string
  location?: string; action?: string; environmentDetails?: string; emotions?: CharacterEmotion[]
  dialogue?: string; speaker?: string; narration?: string; beats?: Beat[]
  referenceVideo?: { title: string; url: string }
  trimStartSeconds?: number; trimEndSeconds?: number
}
export interface Scene { id: string; title: string; description: string; sceneVisualAnchor?: string; shots: Shot[] }
export interface Storyboard { title?: string; chapter?: string; characters: Character[]; scenes: Scene[] }
export interface VideoReference { title: string; url: string; thumbnail?: string }
export interface Workspace { [key: string]: unknown; name: string; ownerId: string }
export interface Membership { [key: string]: unknown; workspaceId: string; userId: string; role: WorkspaceRole; status: 'active' | 'suspended' }
export interface Project {
  [key: string]: unknown
  workspaceId: string
  title: string
  description: string
  script: string
  revision: number
  storyboard: Storyboard
  currentAssets: Record<string, string>
  lastParseJobId: string
  lastParseRevision: number
  notifyOnExport: boolean
  referenceCandidates: VideoReference[]
  referenceQuery: string
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
  providerPhase?: string
  providerStartedAt?: number | null
  providerFinishedAt?: number | null
  outputAssetId: string
  outputVersion: number
  error: string
  requestedByUserId: string
  catalogAttempted?: boolean
  catalogResult?: { storyboard?: Storyboard; asset?: { storageKey: string; mimeType: string; sha256: string; byteSize: number } }
  notificationStatus?: 'none' | 'attempted' | 'sent' | 'failed'
  notificationError?: string
  request: Record<string, unknown>
}
export type Row<T> = { recordId: string; data: T; createdAt?: string; updatedAt?: string }

export const emptyStoryboard = (): Storyboard => ({ characters: [], scenes: [] })
export const assetSlot = (operation: Operation, targetId: string) => `${operation}:${targetId}`
