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

    await expect(searchListings()).resolves.toEqual(searchResponse())
    expect(apiFetch).toHaveBeenCalledWith('/api/busqueda')
  })

  it('searchListings sends the text URL-encoded as q', async () => {
    vi.mocked(apiFetch).mockResolvedValue(searchResponse())

    await searchListings('Corolla automático & 2021')

    expect(apiFetch).toHaveBeenCalledWith('/api/busqueda?q=Corolla%20autom%C3%A1tico%20%26%202021')
  })

  it('searchListings treats a blank text as no query', async () => {
    vi.mocked(apiFetch).mockResolvedValue(searchResponse())

    await searchListings('   ')

    expect(apiFetch).toHaveBeenCalledWith('/api/busqueda')
  })
})
