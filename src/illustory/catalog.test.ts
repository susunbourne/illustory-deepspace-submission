import { afterEach, describe, expect, it, vi } from 'vitest'
import { dataUriToBytes, generateCatalogImage } from './catalog'

describe('Catalog image response boundary', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('converts a trusted hosted image to private-ingest bytes', async () => {
    const bytes = new Uint8Array(200).fill(42)
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { 'Content-Type': 'image/png', 'Content-Length': '200' } }))
    vi.stubGlobal('fetch', fetcher)
    const uri = await generateCatalogImage(async () => ({ images: ['https://oaidalleapiprodscus.blob.core.windows.net/image.png'] }), 'A station')
    expect(dataUriToBytes(uri).bytes).toEqual(bytes)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('never fetches an unexpected provider URL', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(generateCatalogImage(async () => ({ images: ['http://127.0.0.1/internal'] }), 'A station')).rejects.toThrow('untrusted')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
