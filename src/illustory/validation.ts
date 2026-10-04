import type { Storyboard } from './types'

export function validStoryboard(value: unknown): value is Storyboard {
  if (!value || typeof value !== 'object') return false
  const b = value as Storyboard
  const safeId = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id)
  if (!Array.isArray(b.characters) || !Array.isArray(b.scenes)) return false
  if (!b.characters.every(c => c && typeof c === 'object') || !b.scenes.every(s => s && typeof s === 'object' && Array.isArray(s.shots) && s.shots.every(q => q && typeof q === 'object'))) return false
  const ids = [...b.characters.map(c => c.id), ...b.scenes.map(s => s.id), ...b.scenes.flatMap(s => Array.isArray(s.shots) ? s.shots.map(q => q.id) : [])]
  if (new Set(ids).size !== ids.length) return false
  return b.characters.every(c => safeId(c.id) && typeof c.name === 'string' && typeof c.description === 'string')
    && b.scenes.every(s => safeId(s.id) && typeof s.title === 'string' && typeof s.description === 'string'
      && Array.isArray(s.shots) && s.shots.every(q => safeId(q.id) && typeof q.title === 'string' && typeof q.description === 'string'
        && Number.isInteger(q.durationSeconds) && q.durationSeconds >= 3 && q.durationSeconds <= 15
        && (q.trimStartSeconds === undefined || (Number.isFinite(q.trimStartSeconds) && q.trimStartSeconds >= 0))
        && (q.trimEndSeconds === undefined || (Number.isFinite(q.trimEndSeconds) && q.trimEndSeconds >= 0))))
}
