import type { Character, Storyboard } from './types'

export const SCRIPT_MODEL = 'gpt-5.6-luna'
export const IMAGE_MODEL = 'gpt-image-2'
export const PROMPT_VERSION = 'illustory-original-parser-v1'

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Catalog chat-completion does not currently expose a curated output schema. */
export function chatText(raw: unknown): string {
  const outer = object(raw) && object(raw.response) ? raw.response : raw
  if (!object(outer)) throw new Error('OpenAI returned an invalid response')
  if (typeof outer.output_text === 'string') return outer.output_text
  const choices = outer.choices
  if (Array.isArray(choices) && object(choices[0])) {
    const message = choices[0].message
    if (object(message)) {
      if (typeof message.content === 'string') return message.content
      if (Array.isArray(message.content)) return message.content.map((p: unknown) => object(p) && typeof p.text === 'string' ? p.text : '').join('')
    }
  }
  if (Array.isArray(outer.content)) return outer.content.map((p: unknown) => object(p) && typeof p.text === 'string' ? p.text : '').join('')
  throw new Error('OpenAI returned no text content')
}

export function voiceText(board: Storyboard, character: Character): string {
  const beatLines = board.scenes.flatMap(scene => scene.shots.flatMap(shot => (shot.beats ?? []).filter(beat => beat.speaker === character.name && beat.dialogue).map(beat => beat.dialogue ?? '')))
  const shotLines = board.scenes.flatMap(scene => scene.shots.filter(shot => shot.speaker === character.name && shot.dialogue).map(shot => shot.dialogue ?? ''))
  return (beatLines.length ? beatLines : shotLines).join(' ').slice(0, 240).trim()
}
