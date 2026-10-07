import type { CollectionSchema } from 'deepspace/schema'

// Product records are accessed through authenticated server actions. SDK client
// subscriptions have no broad collection read grant because membership is per workspace.
const serverOnly = {
  viewer: { read: false, create: false, update: false, delete: false },
  member: { read: false, create: false, update: false, delete: false },
  admin: { read: false, create: false, update: false, delete: false },
}
const text = (name: string) => ({ name, storage: 'text' as const, interpretation: 'plain' as const })
const number = (name: string) => ({ name, storage: 'number' as const, interpretation: 'plain' as const })
const json = (name: string) => ({ name, storage: 'text' as const, interpretation: { kind: 'json' as const } })

export const illustorySchemas: CollectionSchema[] = [
  { name: 'workspaces', columns: [text('name'), text('ownerId')], permissions: serverOnly },
  {
    name: 'memberships',
    columns: [text('workspaceId'), text('userId'), text('role'), text('status')],
    permissions: serverOnly,
  },
  {
    name: 'access-requests',
    columns: [text('userId'), text('requestedAt')],
    permissions: serverOnly,
  },
  {
    name: 'projects',
    columns: [
      text('workspaceId'),
      text('title'),
      text('description'),
      text('script'),
      number('revision'),
      json('storyboard'),
      json('currentAssets'),
      text('lastParseJobId'),
      number('lastParseRevision'),
      json('referenceCandidates'),
      text('referenceQuery'),
      json('notifyOnExport'),
      text('createdByUserId'),
    ],
    permissions: serverOnly,
  },
  {
    name: 'assets',
    columns: [
      text('workspaceId'),
      text('projectId'),
      text('operation'),
      text('targetType'),
      text('targetId'),
      number('version'),
      number('inputRevision'),
      text('storageKey'),
      text('mimeType'),
      text('sha256'),
      number('byteSize'),
      text('createdByJobId'),
      text('createdByUserId'),
    ],
    permissions: serverOnly,
  },
  {
    name: 'workflow-jobs',
    columns: [
      text('workspaceId'),
      text('projectId'),
      text('operation'),
      text('targetType'),
      text('targetId'),
      number('inputRevision'),
      text('idempotencyKey'),
      text('status'),
      number('progress'),
      text('providerJobId'),
      text('providerPhase'),
      number('providerStartedAt'),
      number('providerFinishedAt'),
      number('outputVersion'),
      text('outputAssetId'),
      text('error'),
      text('requestedByUserId'),
      json('catalogAttempted'),
      json('catalogResult'),
      text('notificationStatus'),
      text('notificationError'),
      json('request'),
    ],
    permissions: serverOnly,
  },
]
