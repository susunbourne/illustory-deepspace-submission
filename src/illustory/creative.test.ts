import { describe, expect, it } from 'vitest'
import { voiceText } from './creative'
import type { Character, Storyboard } from './types'

const character: Character = { id: 'ari', name: 'Ari', description: '' }
const board = (dialogue: string, beatDialogue?: string): Storyboard => ({
  characters: [character],
  scenes: [
    {
      id: 'scene',
      title: 'Station',
      description: '',
      shots: [
        {
          id: 'shot',
          title: 'Arrival',
          description: '',
          durationSeconds: 3,
          speaker: 'Ari',
          dialogue,
          beats: beatDialogue
            ? [{ id: 'beat', description: '', durationSeconds: 3, speaker: 'Ari', dialogue: beatDialogue }]
            : [],
        },
      ],
    },
  ],
})

describe('character voice reference text', () => {
  it('uses beat dialogue without repeating the shot-level line', () => {
    expect(voiceText(board('Repeated line', 'The train is here.'), character)).toBe('The train is here.')
  })
  it('falls back to shot dialogue and excludes other speakers', () => {
    expect(voiceText(board('Hello.'), character)).toBe('Hello.')
    expect(voiceText(board('Hello.'), { ...character, name: 'Someone else' })).toBe('')
  })
  it('bounds the voice preview to 240 characters', () => {
    expect(voiceText(board('a'.repeat(300)), character)).toHaveLength(240)
  })
})
