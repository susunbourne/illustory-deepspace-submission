import type { VideoReference } from './types'

type IntegrationCall = (endpoint: string, params?: Record<string, unknown>) => Promise<unknown>
const object = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
const unwrap = (v: unknown) => object(v)?.response ?? v

export async function generateCatalogImage(call: IntegrationCall, prompt: string, signal?: AbortSignal): Promise<string> {
  const result = object(unwrap(await call('openai/generate-image', { prompt, model: 'gpt-image-2', n: 1, size: '1536x1024', quality: 'medium' })))
  const images = result?.images
  const image = Array.isArray(images) ? images[0] : null
  if (typeof image !== 'string') throw new Error('OpenAI image response did not contain an image')
  if (image.startsWith('data:image/')) return image
  // The Catalog contract also allows a hosted URL. Fetch only expected
  // provider storage over HTTPS, with redirects disabled, then keep the bytes
  // behind the same private asset boundary as data-URI results.
  const url = new URL(image)
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || ![
    'openai.com', 'openaiusercontent.com', 'blob.core.windows.net',
  ].some(domain => host === domain || host.endsWith(`.${domain}`))) throw new Error('OpenAI returned an untrusted image URL')
  const response = await fetch(url, { redirect: 'manual', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30_000)]) : AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`OpenAI hosted image returned HTTP ${response.status}`)
  const mimeType = response.headers.get('Content-Type')?.split(';', 1)[0].toLowerCase()
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') throw new Error('OpenAI hosted image has an unsupported media type')
  if (Number(response.headers.get('Content-Length') || 0) > 20 * 1024 * 1024) throw new Error('OpenAI hosted image is too large')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < 100 || bytes.length > 20 * 1024 * 1024) throw new Error('OpenAI hosted image size is outside the allowed range')
  const chunks: string[] = []
  for (let i = 0; i < bytes.length; i += 8192) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
  return `data:${mimeType};base64,${btoa(chunks.join(''))}`
}

export async function generateCatalogVoice(call: IntegrationCall, voiceId: string, text: string): Promise<string> {
  const result = object(unwrap(await call('elevenlabs/generate-speech', {
    voice_id: voiceId, text, model_id: 'eleven_multilingual_v2', output_format: 'mp3_44100_128',
  })))
  const audio = result?.audioUrl
  if (typeof audio !== 'string' || !audio.startsWith('data:audio/')) throw new Error('ElevenLabs response did not contain an audio data URI')
  return audio
}

export function voiceChoices(raw: unknown): Array<{ id: string; name: string; previewUrl: string }> {
  const result = object(unwrap(raw))
  const voices = result?.voices
  if (!Array.isArray(voices)) throw new Error('ElevenLabs returned no voice list')
  return voices.map(v => object(v)).filter((v): v is Record<string, unknown> => !!v && typeof v.voice_id === 'string' && typeof v.name === 'string')
    .slice(0, 50).map(v => ({ id: v.voice_id as string, name: v.name as string,
      previewUrl: typeof v.preview_url === 'string' && /^https:\/\//.test(v.preview_url) ? v.preview_url : '' }))
}

export function youtubeReferences(raw: unknown): VideoReference[] {
  const result = object(unwrap(raw))
  if (!Array.isArray(result?.videos)) throw new Error('YouTube returned an invalid result')
  return result.videos.slice(0, 3).flatMap((v): VideoReference[] => {
    const item = object(v), links = object(item?.links), snippet = object(item?.snippet)
    const url = links?.watch
    if (typeof url !== 'string' || !/^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(url)) return []
    return [{ url, title: typeof item?.title === 'string' ? item.title : typeof snippet?.title === 'string' ? snippet.title : url,
      thumbnail: typeof links?.thumbnail === 'string' && /^https:\/\//.test(links.thumbnail) ? links.thumbnail : undefined }]
  })
}

export function dataUriToBytes(uri: string): { bytes: Uint8Array<ArrayBuffer>; mimeType: string } {
  const match = /^data:(image\/png|image\/jpeg|audio\/mpeg);base64,([A-Za-z0-9+/=]+)$/.exec(uri)
  if (!match) throw new Error('Unsupported catalog media format')
  const binary = atob(match[2])
  if (binary.length < 100 || binary.length > 20 * 1024 * 1024) throw new Error('Catalog media size is outside the allowed range')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { bytes, mimeType: match[1] }
}

export async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map(b => b.toString(16).padStart(2, '0')).join('')
}
