import { expect, it } from 'vitest'
import { lintSchemas } from 'deepspace/worker'
import { schemas } from '../schemas'

it('keeps product collections unavailable through direct client record permissions', () => {
  expect(lintSchemas(schemas)).toEqual([])
  for (const schema of schemas.filter(s => !['users', 'settings'].includes(s.name))) {
    for (const rule of Object.values(schema.permissions)) {
      expect(rule.read).toBe(false)
      expect(rule.create).toBe(false)
      expect(rule.update).toBe(false)
      expect(rule.delete).toBe(false)
    }
  }
})
