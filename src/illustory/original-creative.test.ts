import { describe, expect, it } from 'vitest'
import { characterMessages, originalCharacterImagePrompt, originalSceneImagePrompt, parseCharacterBible, parseOriginalStoryboard, sceneMessages } from './original-creative'

export const characterReply = { characters: [{ name: 'Ari', name_en: 'Ari', personality: 'Reserved scientist', appearance: {
  nationality: 'Canadian', gender: 'woman', age_range: '30s', hair: 'black', face: 'angular', body: 'tall', costume: 'lab coat',
}, reference_image_path: null, lora_url: null, voice_id: null }] }
export const sceneReply = { title: 'Arrival', chapter: 'One', scenes: [{ scene_id: 'scene_01', title: 'Station', scene_visual_anchor: 'Wet platform, clock at the north wall.', shots: [{
  shot_id: 'scene_01_shot_01', location: 'Platform', time_of_day: 'night', characters: ['Ari'],
  action: 'Ari stands beside the clock, facing the train.', environment_details: 'Rain is visible behind Ari.',
  motion: { beats: [{ beat_id: 'beat_01', description: 'Ari turns toward the train.', duration_seconds: 3, speaker: null, dialogue: null }] },
  shot_type: 'medium_shot', camera_angle: 'three quarter angle', emotions: { emotions: [{ character: 'Ari', emotion: 'tense' }] },
  speaker: null, narration: null, dialogue: null, duration_seconds: 3,
}] }] }

describe('original Illustory production contract', () => {
  it('retains every source field through character and scene parsing', () => {
    const bible = parseCharacterBible(JSON.stringify(characterReply))
    const board = parseOriginalStoryboard(JSON.stringify(sceneReply), bible)
    expect(board.title).toBe('Arrival')
    expect(board.chapter).toBe('One')
    expect(board.characters[0].appearance?.nationality).toBe('Canadian')
    expect(board.characters[0].nameEn).toBe('Ari')
    expect(board.scenes[0].sceneVisualAnchor).toContain('north wall')
    expect(board.scenes[0].shots[0]).toMatchObject({ location: 'Platform', environmentDetails: 'Rain is visible behind Ari.', action: 'Ari stands beside the clock, facing the train.', characters: ['c1'], durationSeconds: 3 })
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
