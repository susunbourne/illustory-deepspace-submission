import { describe, expect, it } from 'vitest'
import {
  characterMessages,
  originalCharacterImagePrompt,
  originalSceneImagePrompt,
  parseCharacterBible,
  parseOriginalStoryboard,
  sceneMessages,
} from './original-creative'

import { characterReply, sceneReply } from './fixtures/creative'

describe('original Illustory production contract', () => {
  it('retains every source field through character and scene parsing', () => {
    const bible = parseCharacterBible(JSON.stringify(characterReply))
    const board = parseOriginalStoryboard(JSON.stringify(sceneReply), bible)
    expect(board.title).toBe('Arrival')
    expect(board.chapter).toBe('One')
    expect(board.characters[0].appearance?.nationality).toBe('Canadian')
    expect(board.characters[0].nameEn).toBe('Ari')
    expect(board.scenes[0].sceneVisualAnchor).toContain('north wall')
    expect(board.scenes[0].shots[0]).toMatchObject({
      location: 'Platform',
      environmentDetails: 'Rain is visible behind Ari.',
      action: 'Ari stands beside the clock, facing the train.',
      characters: ['c1'],
      durationSeconds: 3,
    })
    expect(board.scenes[0].shots[0].emotions).toEqual([{ characterId: 'c1', emotion: 'tense' }])
    expect(board.scenes[0].shots[0].beats).toMatchObject([{ id: 'beat_01', durationSeconds: 3 }])
    expect(originalCharacterImagePrompt(board.characters[0])).toContain('Nationality: Canadian')
    expect(originalSceneImagePrompt(board.scenes[0])).toContain('Location: Platform')
    expect(characterMessages('a script')[0].content).toContain('Character Bible')
    expect(sceneMessages('a script', bible)[0].content).toContain('Scene Visual Anchor Rule')
  })
  it('rejects malformed structured output instead of silently normalizing it', () => {
    const bible = parseCharacterBible(JSON.stringify(characterReply))
    const bad = structuredClone(sceneReply)
    bad.scenes[0].shots[0].duration_seconds = 4
    expect(() => parseOriginalStoryboard(JSON.stringify(bad), bible)).toThrow('Motion timing')
    const unknown = structuredClone(sceneReply)
    unknown.scenes[0].shots[0].characters = ['Unknown']
    expect(() => parseOriginalStoryboard(JSON.stringify(unknown), bible)).toThrow('Unknown shot character')
  })
})
