import { describe, expect, it } from 'vitest'
import { chatText, parseStoryboard } from './creative'
import { validStoryboard } from './validation'

describe('OpenAI production-plan boundary', () => {
  it('extracts the catalog chat envelope and normalizes motion timing for H3', () => {
    const content = JSON.stringify({
      characters: [{ name: 'Ari', description: 'A traveler', appearance: { hair: 'black' } }],
      scenes: [{ title: 'Station', description: 'Rain at night', shots: [{
        title: 'Arrival', description: 'Ari waits', durationSeconds: 3, characters: ['Ari'],
        beats: [{ description: 'Train arrives', durationSeconds: 2 }, { description: 'Ari turns', durationSeconds: 4 }],
      }] }],
    })
    const board = parseStoryboard(chatText({ choices: [{ message: { content } }] }))
    const shot = board.scenes[0].shots[0]
    expect(shot.durationSeconds).toBe(4)
    expect(shot.beats?.reduce((sum, beat) => sum + beat.durationSeconds, 0)).toBe(4)
    expect(shot.characters).toEqual(['c1'])
    expect(validStoryboard(board)).toBe(true)
  })
  it('rejects missing or malformed production data before publication', () => {
    expect(() => chatText({ choices: [] })).toThrow('no text')
    expect(() => parseStoryboard('{"characters":[],"scenes":[]}')).toThrow('size')
    expect(validStoryboard({ characters: [], scenes: [{ id: 's', title: 'x', description: '', shots: [{ id: 'q', title: 'x', description: '', durationSeconds: 3 }] }] })).toBe(false)
  })
})
