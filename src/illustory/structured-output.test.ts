import { afterEach, describe, expect, it, vi } from 'vitest'
import { characterListSchema, storyboardSchema, structuredResponse } from './structured-output'

afterEach(() => vi.unstubAllGlobals())

describe('provider-enforced Illustory parsing contracts', () => {
  it('keeps the original scene and emotion enum in a strict schema', () => {
    const scene = (storyboardSchema.properties as Record<string, unknown>).scenes as { items: { properties: Record<string, unknown> } }
    const shot = ((scene.items.properties.shots as { items: { properties: Record<string, unknown> } }).items.properties)
    const emotion = ((((shot.emotions as { properties: Record<string, unknown> }).properties.emotions as { items: { properties: Record<string, unknown> } }).items.properties.emotion)) as { enum: string[] }
    expect(emotion.enum).toEqual(['tense', 'melancholy', 'fearful', 'determined', 'neutral'])
    expect(shot.motion).toBeDefined()
    expect(storyboardSchema.additionalProperties).toBe(false)
    expect(characterListSchema.additionalProperties).toBe(false)
  })

  it('sends strict JSON Schema only from the server and accepts a completed response', async () => {
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const request = JSON.parse(options.body as string)
      expect(request.store).toBe(false)
      expect(request.max_output_tokens).toBe(5000)
      expect(request.text.format).toMatchObject({ type: 'json_schema', strict: true, name: 'characters' })
      expect(request.text.format.schema).toEqual(characterListSchema)
      expect((options.headers as Record<string, string>).Authorization).toBe('Bearer test-only')
      return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"characters":[]}' }] }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(structuredResponse('test-only', 'gpt-4o-mini', 'characters', characterListSchema, [{ role: 'user', content: 'test' }], 5000)).resolves.toBe('{"characters":[]}')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('fails before making a paid request when the server secret is absent', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(structuredResponse(undefined, 'gpt-4o-mini', 'characters', characterListSchema, [], 5000)).rejects.toThrow('not configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
