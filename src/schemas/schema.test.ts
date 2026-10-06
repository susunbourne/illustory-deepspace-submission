import { expect, it } from 'vitest'
import { lintSchemas } from 'deepspace/worker'
import { schemas } from '../schemas'

it('keeps product collections unavailable through direct client record permissions', () => {
  expect(lintSchemas(schemas)).toEqual([])
  for (const schema of schemas.filter((s) => !['users', 'settings'].includes(s.name))) {
    for (const rule of Object.values(schema.permissions)) {
      expect(rule.read).toBe(false)
      expect(rule.create).toBe(false)
      expect(rule.update).toBe(false)
      expect(rule.delete).toBe(false)
    }
  }
})

it('persists private execution evidence on workflow jobs', () => {
  const jobSchema = schemas.find((schema) => schema.name === 'workflow-jobs')
  expect(jobSchema?.columns.map((column) => column.name)).toEqual(
    expect.arrayContaining([
      'providerJobId',
      'providerPhase',
      'providerStartedAt',
      'providerFinishedAt',
      'inputRevision',
      'outputVersion',
      'outputAssetId',
    ]),
  )
})
