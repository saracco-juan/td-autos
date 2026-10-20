import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../lib/http'
import { createVehicle, fetchBodyTypes } from './api'
import { MATCHING_FACTS, vehiculo } from './fixtures'
import { matchingValues } from './matchingFields'
import NewVehiclePage from './NewVehiclePage'

vi.mock('./api', () => ({ createVehicle: vi.fn(), fetchBodyTypes: vi.fn() }))

function Inventory() {
  const location = useLocation()
  return <p>Inventario: {JSON.stringify(location.state)}</p>
}

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/concesionaria/inventario/nuevo']}>
      <Routes>
        <Route path="/concesionaria/inventario/nuevo" element={<NewVehiclePage />} />
        <Route path="/concesionaria/inventario" element={<Inventory />} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByLabelText('Patente')
}

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function fillAndAddPhotos() {
  fill('Patente', 'AB123CD')
  fill('Marca', 'Toyota')
  fill('Modelo', 'Corolla')
  fill('Año', '2021')
  fill('Kilometraje', '60000')
  fill('Precio', '18500000')
  fill('Transmisión', 'automatica')
  fill('Combustible', 'nafta')
  fill('Carrocería', '1')
  fill('Ubicación', 'Córdoba')
  for (const [key, value] of Object.entries(matchingValues(MATCHING_FACTS))) {
    if (key === 'potencia_unidad') continue
    fireEvent.change(document.getElementById(`vehicle-${key}`)!, { target: { value } })
  }
  const photos = Array.from({ length: 7 }, (_, index) => new File(['x'], `f${index}.jpg`, { type: 'image/jpeg' }))
  await userEvent.setup().upload(screen.getByLabelText('AGREGAR IMAGEN'), photos)
  return photos
}

describe('NewVehiclePage', () => {
  beforeEach(() => {
    vi.mocked(createVehicle).mockReset()
    vi.mocked(fetchBodyTypes).mockReset()
    vi.mocked(fetchBodyTypes).mockResolvedValue([{ id: 1, nombre: 'Sedán' }])
  })

  it('renders the header of Figma 38:923 with a back link to the inventory and an empty form', async () => {
    await renderPage()

    expect(screen.getByRole('link', { name: 'Volver al inventario' })).toHaveAttribute('href', '/concesionaria/inventario')
    expect(screen.getByText('INVENTARIO')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Cargar vehículo' })).toBeInTheDocument()
    expect(screen.getByText('La patente debe ser única en toda la plataforma. Subí al menos 7 fotos del vehículo.')).toBeInTheDocument()
    expect(screen.getByLabelText('Patente')).toHaveValue('')
    expect(screen.getByText('0 de 7 imágenes cargadas.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GUARDAR VEHÍCULO' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CANCELAR' })).toHaveAttribute('href', '/concesionaria/inventario')
  })

  it('creates the vehicle and goes to the inventory with the success notice', async () => {
    vi.mocked(createVehicle).mockResolvedValue(vehiculo())
    await renderPage()
    const photos = await fillAndAddPhotos()

    await userEvent.setup().click(screen.getByRole('button', { name: 'GUARDAR VEHÍCULO' }))

    expect(await screen.findByText(/^Inventario:/)).toHaveTextContent('{"notice":"Cargaste el vehículo."}')
    expect(createVehicle).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(createVehicle).mock.calls[0][0]
    expect(sent.values.patente).toBe('AB123CD')
    expect(sent.newPhotos).toEqual(photos)
    expect(sent.removedPhotoIds).toEqual([])
  })

  it('stays on the form with the data when the save fails', async () => {
    vi.mocked(createVehicle).mockRejectedValue(new HttpError(500, undefined))
    await renderPage()
    await fillAndAddPhotos()

    await userEvent.setup().click(screen.getByRole('button', { name: 'GUARDAR VEHÍCULO' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar el vehículo. Probá de nuevo.')
    expect(screen.getByLabelText('Marca')).toHaveValue('Toyota')
    expect(screen.queryByText(/^Inventario:/)).not.toBeInTheDocument()
  })
})
