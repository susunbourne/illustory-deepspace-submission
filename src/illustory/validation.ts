import type { Storyboard } from './types'

export function validStoryboard(value: unknown): value is Storyboard {
  if (!value || typeof value !== 'object') return false
  const b = value as Storyboard
  const safeId = (id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(id)
  if (!Array.isArray(b.characters) || !Array.isArray(b.scenes)) return false
  if (!b.characters.every(c => c && typeof c === 'object') || !b.scenes.every(s => s && typeof s === 'object' && Array.isArray(s.shots) && s.shots.every(q => q && typeof q === 'object'))) return false
  const ids = [...b.characters.map(c => c.id), ...b.scenes.map(s => s.id), ...b.scenes.flatMap(s => Array.isArray(s.shots) ? s.shots.map(q => q.id) : [])]
  if (new Set(ids).size !== ids.length) return false
  const shortText = (v: unknown, max = 5000) => typeof v === 'string' && v.length <= max
  const optionalText = (v: unknown, max = 5000) => v === undefined || shortText(v, max)
  const validBeat = (v: unknown) => {
    if (!v || typeof v !== 'object') return false
    const beat = v as { id?: unknown; description?: unknown; durationSeconds?: unknown; speaker?: unknown; dialogue?: unknown }
    return safeId(beat.id) && shortText(beat.description) && Number.isInteger(beat.durationSeconds)
      && Number(beat.durationSeconds) >= 1 && Number(beat.durationSeconds) <= 15
      && optionalText(beat.speaker, 120) && optionalText(beat.dialogue)
  }
  return optionalText(b.title, 200) && optionalText(b.chapter, 200)
    && b.characters.every(c => safeId(c.id) && shortText(c.name, 120) && shortText(c.description)
      && optionalText(c.nameEn, 120) && optionalText(c.personality) && optionalText(c.voiceId, 120)
      && optionalText(c.referenceImagePath, 1000) && optionalText(c.loraUrl, 1000)
      && (c.appearance === undefined || (typeof c.appearance === 'object' && c.appearance !== null
        && Object.values(c.appearance).every(v => shortText(v, 500)))))
    && b.scenes.every(s => safeId(s.id) && typeof s.title === 'string' && typeof s.description === 'string' && optionalText(s.sceneVisualAnchor)
      && Array.isArray(s.shots) && s.shots.every(q => safeId(q.id) && typeof q.title === 'string' && typeof q.description === 'string'
        && Number.isInteger(q.durationSeconds) && q.durationSeconds >= 3 && q.durationSeconds <= 15
        && (q.characters === undefined || (Array.isArray(q.characters) && q.characters.every(v => safeId(v))))
        && optionalText(q.shotType, 120) && optionalText(q.cameraAngle, 120) && optionalText(q.timeOfDay, 120)
        && optionalText(q.location, 500) && optionalText(q.action) && optionalText(q.environmentDetails)
        && (q.emotions === undefined || (Array.isArray(q.emotions) && q.emotions.every(e => safeId(e.characterId)
          && ['tense', 'melancholy', 'fearful', 'determined', 'neutral'].includes(e.emotion))))
        && optionalText(q.dialogue) && optionalText(q.speaker, 120) && optionalText(q.narration)
        && (q.beats === undefined || (Array.isArray(q.beats) && q.beats.every(validBeat)
          && (!q.beats.length || q.beats.reduce((sum, beat) => sum + beat.durationSeconds, 0) === q.durationSeconds)))
        && (q.referenceVideo === undefined || (shortText(q.referenceVideo.title, 300)
          && typeof q.referenceVideo.url === 'string' && /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(q.referenceVideo.url)))
        && (q.trimStartSeconds === undefined || (Number.isFinite(q.trimStartSeconds) && q.trimStartSeconds >= 0))
        && (q.trimEndSeconds === undefined || (Number.isFinite(q.trimEndSeconds) && q.trimEndSeconds >= 0))))
}
