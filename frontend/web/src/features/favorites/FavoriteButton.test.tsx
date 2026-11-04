import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { setFavorite } from './api'
import FavoriteButton from './FavoriteButton'

vi.mock('./api', () => ({ setFavorite: vi.fn() }))

beforeEach(() => { vi.mocked(setFavorite).mockReset().mockResolvedValue(undefined) })

it('exposes the saved state and toggles it with an accessible label', async () => {
  render(<FavoriteButton vehicleId={7} vehicleName="Toyota Corolla" />)
  const save = screen.getByRole('button', { name: 'Guardar Toyota Corolla en favoritos' })
  expect(save).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(save)

  expect(screen.getByRole('button', { name: 'Quitar Toyota Corolla de favoritos' })).toHaveAttribute('aria-pressed', 'true')
  expect(setFavorite).toHaveBeenCalledExactlyOnceWith(7, true)
})
