/** The source Illustory Pydantic contracts, expressed as strict OpenAI JSON Schemas. */
type Schema = Record<string, unknown>
const string: Schema = { type: 'string' }
const nullableString: Schema = { type: ['string', 'null'] }
const integer = (minimum: number, maximum: number): Schema => ({ type: 'integer', minimum, maximum })
const array = (items: Schema): Schema => ({ type: 'array', items })
const object = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

export const characterListSchema = object({
  characters: array(
    object({
      name: string,
      name_en: nullableString,
      appearance: object({
        nationality: string,
        gender: string,
        age_range: string,
        hair: string,
        face: string,
        body: string,
        costume: string,
      }),
      personality: string,
      reference_image_path: nullableString,
      lora_url: nullableString,
      voice_id: nullableString,
    }),
  ),
})

export const storyboardSchema = object({
  title: string,
  chapter: string,
  scenes: array(
    object({
      scene_id: string,
      title: string,
      scene_visual_anchor: string,
      shots: array(
        object({
          shot_id: string,
          location: string,
          time_of_day: string,
          characters: array(string),
          action: {
            type: 'string',
            description: 'The static visual state of the first frame. Put movement in motion.beats.',
          },
          environment_details: string,
          motion: object({
            beats: array(
              object({
                beat_id: string,
                description: string,
                duration_seconds: integer(1, 15),
                speaker: nullableString,
                dialogue: nullableString,
              }),
            ),
          }),
          shot_type: { type: 'string', enum: ['close_up', 'medium_shot', 'wide_shot', 'extreme_wide'] },
          camera_angle: {
            type: 'string',
            enum: ['three quarter angle', 'low angle looking up', 'high angle looking down'],
          },
          emotions: object({
            emotions: array(
              object({
                character: string,
                emotion: {
                  type: 'string',
                  enum: ['tense', 'melancholy', 'fearful', 'determined', 'neutral'],
                },
              }),
            ),
          }),
          speaker: nullableString,
          narration: nullableString,
          dialogue: nullableString,
          duration_seconds: integer(3, 15),
        }),
      ),
    }),
  ),
})

type Message = { role: 'system' | 'user'; content: string }
type OutputPart = { type?: string; text?: string; refusal?: string }
type OpenAIResponse = { status?: string; output?: { type?: string; content?: OutputPart[] }[] }

/** OpenAI Responses with provider-enforced schema, called only from the Worker. */
export async function structuredResponse(
  apiKey: string | undefined,
  model: string,
  name: string,
  schema: Schema,
  messages: readonly Message[],
  maxOutputTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  if (!apiKey)
    throw new Error('OpenAI structured parsing is not configured. Set the server-only OPENAI_API_KEY secret.')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: messages,
      store: false,
      max_output_tokens: maxOutputTokens,
      text: { format: { type: 'json_schema', name, strict: true, schema } },
    }),
    signal,
  })
  if (!response.ok) throw new Error(`OpenAI structured parsing failed (HTTP ${response.status})`)
  const result = (await response.json()) as OpenAIResponse
  if (result.status !== 'completed')
    throw new Error(`OpenAI structured parsing did not complete: ${result.status ?? 'unknown'}`)
  const parts =
    result.output?.filter((item) => item.type === 'message').flatMap((item) => item.content ?? []) ?? []
  if (parts.some((part) => part.type === 'refusal')) throw new Error('OpenAI refused to parse this script')
  const output = parts
    .filter((part) => part.type === 'output_text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  if (!output) throw new Error('OpenAI structured parsing returned no text')
  return output
}
