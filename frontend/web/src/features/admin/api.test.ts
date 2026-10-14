import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/http', () => ({ apiFetch: vi.fn() }))

import { apiFetch } from '../../lib/http'
import { fetchDealerDirectory } from './api'
import { directory } from './fixtures'

describe('admin api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('fetchDealerDirectory GETs the dealers with their counts', async () => {
    const summary = directory()
    vi.mocked(apiFetch).mockResolvedValue(summary)

    await expect(fetchDealerDirectory()).resolves.toEqual(summary)
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/concesionarias')
  })

  it('lets the errors of apiFetch propagate', async () => {
    const failure = new Error('HTTP 500')
    vi.mocked(apiFetch).mockRejectedValue(failure)

    await expect(fetchDealerDirectory()).rejects.toBe(failure)
  })
})
