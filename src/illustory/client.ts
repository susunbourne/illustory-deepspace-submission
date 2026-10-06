import { getAuthToken } from 'deepspace'

export async function action<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in to continue')
  const response = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const body = (await response.json().catch(() => null)) as {
    success: boolean
    data?: T
    error?: string
  } | null
  if (!response.ok || !body?.success) throw new Error(body?.error ?? `Request failed (${response.status})`)
  return body.data as T
}

export async function assetObjectUrl(assetId: string): Promise<string> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in to view assets')
  const response = await fetch(`/api/illustory/assets/${encodeURIComponent(assetId)}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Asset unavailable (${response.status})`)
  return URL.createObjectURL(await response.blob())
}
