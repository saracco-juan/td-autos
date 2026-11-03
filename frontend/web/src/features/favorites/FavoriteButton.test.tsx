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

it('does not celebrate restoring a saved favorite after a failed removal', async () => {
  vi.mocked(setFavorite).mockRejectedValueOnce(new Error('Unavailable'))
  render(<FavoriteButton vehicleId={7} vehicleName="Toyota Corolla" isFavorite />)
  const button = screen.getByRole('button', { name: 'Quitar Toyota Corolla de favoritos' })
  expect(button).toHaveAttribute('data-animate', 'false')
  await userEvent.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo actualizar el favorito')
  expect(button).toHaveAttribute('aria-pressed', 'true')
  expect(button).toHaveAttribute('data-animate', 'false')
  expect(setFavorite).toHaveBeenCalledExactlyOnceWith(7, false)
})

it('saves by keyboard without the pointer confirmation animation', async () => {
  const user = userEvent.setup()
  render(<FavoriteButton vehicleId={7} vehicleName="Toyota Corolla" />)
  await user.tab()
  await user.keyboard(' ')
  const button = screen.getByRole('button', { name: 'Quitar Toyota Corolla de favoritos' })
  expect(button).toHaveAttribute('aria-pressed', 'true')
  expect(button).toHaveAttribute('data-animate', 'false')
  expect(setFavorite).toHaveBeenCalledExactlyOnceWith(7, true)
})
