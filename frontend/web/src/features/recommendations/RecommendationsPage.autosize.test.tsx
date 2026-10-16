import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchListings } from './api'
import { searchMeta, searchResponse } from './fixtures'
import RecommendationsPage from './RecommendationsPage'

vi.mock('./api', () => ({ searchListings: vi.fn() }))

let size = 12
vi.mock('../../components/useAutoPageSize', () => ({ default: () => size }))

const response = (page: number, perPage: number) =>
  searchResponse({ meta: searchMeta({ page, per_page: perPage, total: 60, last_page: Math.ceil(60 / perPage) }) })

// A new element each time, so React renders again and the mocked size is read.
const tree = () => (
  <MemoryRouter>
    <RecommendationsPage />
  </MemoryRouter>
)

describe('RecommendationsPage page size', () => {
  beforeEach(() => {
    size = 12
    vi.mocked(searchListings).mockReset()
    vi.mocked(searchListings).mockResolvedValue(response(1, 12))
  })

  it('asks again with the new size when the screen changes, keeping roughly the first card of the page', async () => {
    const { rerender } = render(tree())
    await screen.findByRole('list', { name: 'Publicaciones' })

    // Page 3 of 12 starts at card 24; with 8 per page that card is on page 4.
    vi.mocked(searchListings).mockResolvedValue(response(3, 12))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Página 3' }))
    await screen.findByRole('button', { name: 'Página 3', current: 'page' })

    vi.mocked(searchListings).mockResolvedValue(response(4, 8))
    size = 8
    rerender(tree())

    await waitFor(() => expect(searchListings).toHaveBeenLastCalledWith({ q: undefined, page: 4, perPage: 8 }))
  })

  it('does not ask again while the size stays the same', async () => {
    const { rerender } = render(tree())
    await screen.findByRole('list', { name: 'Publicaciones' })
    rerender(tree())

    expect(searchListings).toHaveBeenCalledTimes(1)
  })
})
