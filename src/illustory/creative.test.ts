import { describe, expect, it } from 'vitest'
import { chatText, voiceText } from './creative'
import { parseCharacterBible, parseOriginalStoryboard } from './original-creative'
import { characterReply, sceneReply } from './original-creative.test'

describe('Catalog creative response boundary', () => {
  it('extracts chat text and selects character dialogue from motion beats', () => {
    const bible = parseCharacterBible(JSON.stringify(characterReply))
    const board = parseOriginalStoryboard(JSON.stringify(sceneReply), bible)
    expect(chatText({ choices: [{ message: { content: JSON.stringify(sceneReply) } }] })).toContain('scene_visual_anchor')
    expect(voiceText(board, bible[0])).toBe('')
  })
  it('rejects an empty response', () => { expect(() => chatText({ choices: [] })).toThrow('no text') })
})
