import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { vehicle } from '@shared/vehicles/fixtures'
import VehicleGallery from './VehicleGallery'

it('HU09 / TC-26 selects gallery photos with keyboard-accessible controls', async () => {
  const photos = [...vehicle.fotos, { id: 2, url: 'https://example.test/second.jpg', orden: 2 }]
  render(<VehicleGallery photos={photos} title="Toyota Corolla" />)
  expect(screen.getByRole('img', { name: 'Foto 1 de Toyota Corolla' })).toHaveAttribute('src', photos[0].url)
  expect(screen.getByRole('button', { name: 'Ver foto 1 de Toyota Corolla' })).toHaveAttribute('aria-pressed', 'true')
  const second = screen.getByRole('button', { name: 'Ver foto 2 de Toyota Corolla' })
  second.focus()
  await userEvent.keyboard('{Enter}')
  expect(screen.getByRole('img', { name: 'Foto 2 de Toyota Corolla' })).toHaveAttribute('src', photos[1].url)
  expect(second).toHaveAttribute('aria-pressed', 'true')
  expect(second).toHaveFocus()
})

it('HU09 / TC-27 explains an empty gallery without requesting placeholder photos', () => {
  render(<VehicleGallery photos={[]} title="Toyota Corolla" />)
  expect(screen.getByText('Fotos no disponibles.')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

it('HU09 / TC-27 recovers from a broken photo without hiding the remaining gallery', async () => {
  const photos = [...vehicle.fotos, { id: 2, url: 'https://example.test/second.jpg', orden: 2 }]
  render(<VehicleGallery photos={photos} title="Toyota Corolla" />)
  fireEvent.error(screen.getByRole('img', { name: 'Foto 1 de Toyota Corolla' }))
  expect(screen.getByText('Esta foto no está disponible.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Ver foto 2 de Toyota Corolla' }))
  expect(screen.getByRole('img', { name: 'Foto 2 de Toyota Corolla' })).toBeVisible()
  expect(screen.queryByText('Esta foto no está disponible.')).not.toBeInTheDocument()
})

it('uses current photos when the selected photo is removed', async () => {
  const photos = [...vehicle.fotos, { id: 2, url: 'https://example.test/second.jpg', orden: 2 }]
  const { rerender } = render(<VehicleGallery photos={photos} title="Toyota Corolla" />)
  await userEvent.click(screen.getByRole('button', { name: 'Ver foto 2 de Toyota Corolla' }))
  rerender(<VehicleGallery photos={vehicle.fotos} title="Toyota Corolla" />)
  expect(screen.getByRole('img', { name: 'Foto 1 de Toyota Corolla' })).toHaveAttribute('src', vehicle.fotos[0].url)
})
