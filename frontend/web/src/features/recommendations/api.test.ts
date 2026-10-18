import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { searchListings } from './api'
import { searchResponse } from './fixtures'

describe('recommendations api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  // TC-18
  it('searchListings GETs /api/busqueda without a query when there is no text', async () => {
    vi.mocked(apiFetch).mockResolvedValue(searchResponse())

    await expect(searchListings({})).resolves.toEqual(searchResponse())
    expect(apiFetch).toHaveBeenCalledWith('/api/busqueda')
  })

  it('searchListings sends the text URL-encoded as q', async () => {
    vi.mocked(apiFetch).mockResolvedValue(searchResponse())

    await searchListings({ q: 'Corolla automático & 2021' })

    expect(apiFetch).toHaveBeenCalledWith('/api/busqueda?q=Corolla%20autom%C3%A1tico%20%26%202021')
  })

  it('searchListings treats a blank text as no query', async () => {
    vi.mocked(apiFetch).mockResolvedValue(searchResponse())

    await searchListings({ q: '   ' })

    expect(apiFetch).toHaveBeenCalledWith('/api/busqueda')
  })

  it('searchListings sends the page only after the first one', async () => {
    vi.mocked(apiFetch).mockResolvedValue(searchResponse())

    await searchListings({ q: 'fiat', page: 3 })
    await searchListings({ page: 2 })
    await searchListings({ page: 1 })

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/busqueda?q=fiat&page=3')
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/busqueda?page=2')
    expect(apiFetch).toHaveBeenNthCalledWith(3, '/api/busqueda')
  })

  it('searchListings sends per_page when the screen asks for a page size', async () => {
    vi.mocked(apiFetch).mockResolvedValue(searchResponse())

    await searchListings({ q: 'fiat', page: 2, perPage: 8 })
    await searchListings({ perPage: 12 })

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/busqueda?q=fiat&page=2&per_page=8')
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/busqueda?per_page=12')
  })
})
