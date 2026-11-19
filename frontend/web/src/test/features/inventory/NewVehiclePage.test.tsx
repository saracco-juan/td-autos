import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '../../../lib/http'
import { createVehicle, fetchBodyTypes, fetchVehicleCatalog } from '../../../features/inventory/api/client'
import { MATCHING_FACTS, VEHICLE_CATALOG, vehiculo } from '../../fixtures/inventory/fixtures'
import { MATCHING_FIELDS, matchingValues } from '../../../features/inventory/model/matchingFields'
import { VEHICLE_FORM_STEPS } from '../../../features/inventory/model/vehicleFormSteps'
import NewVehiclePage from '../../../features/inventory/pages/NewVehiclePage'

vi.mock('../../../features/inventory/api/client', () => ({ createVehicle: vi.fn(), fetchBodyTypes: vi.fn(), fetchVehicleCatalog: vi.fn() }))

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
  fill('Versión', 'XEI')
  fill('Año', '2021')
  await userEvent.setup().click(screen.getByRole('button', { name: 'SIGUIENTE' }))
  fill('Kilometraje', '60000')
  fill('Precio', '18500000')
  fill('Moneda del precio', 'ARS')
  fill('Ubicación', 'Córdoba')
  await userEvent.setup().click(screen.getByRole('button', { name: 'SIGUIENTE' }))
  fill('Transmisión', 'automatica')
  fill('Combustible', 'nafta')
  fill('Carrocería', '1')
  const facts = matchingValues(MATCHING_FACTS)
  for (const key of VEHICLE_FORM_STEPS[2].fields.filter((field) => MATCHING_FIELDS.includes(field as never))) {
    if (key !== 'potencia_unidad') fireEvent.change(document.getElementById(`vehicle-${key}`)!, { target: { value: facts[key as keyof typeof facts] } })
  }
  await userEvent.setup().click(screen.getByRole('button', { name: 'SIGUIENTE' }))
  for (const key of VEHICLE_FORM_STEPS[3].fields) {
    if (MATCHING_FIELDS.includes(key as never)) {
      fireEvent.change(document.getElementById(`vehicle-${key}`)!, { target: { value: facts[key as keyof typeof facts] } })
    }
  }
  await userEvent.setup().click(screen.getByRole('button', { name: 'SIGUIENTE' }))
  const photos = Array.from({ length: 7 }, (_, index) => new File(['x'], `f${index}.jpg`, { type: 'image/jpeg' }))
  await userEvent.setup().upload(screen.getByLabelText('AGREGAR IMAGEN'), photos)
  return photos
}

describe('NewVehiclePage', () => {
  beforeEach(() => {
    vi.mocked(createVehicle).mockReset()
    vi.mocked(fetchBodyTypes).mockReset()
    vi.mocked(fetchBodyTypes).mockResolvedValue([{ id: 1, nombre: 'Sedán' }])
    vi.mocked(fetchVehicleCatalog).mockResolvedValue(VEHICLE_CATALOG)
  })

  it('renders the header and first creation step with labelled shared progress', async () => {
    await renderPage()

    expect(screen.getByRole('link', { name: 'Volver al inventario' })).toHaveAttribute('href', '/concesionaria/inventario')
    expect(screen.getByText('INVENTARIO')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Cargar vehículo' })).toBeInTheDocument()
    expect(screen.getByText('La patente debe ser única en toda la plataforma. Subí al menos 7 fotos del vehículo.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Carga de vehículo' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument()
    expect(screen.getByLabelText('Patente')).toHaveValue('')
    expect(screen.queryByLabelText('Kilometraje')).not.toBeInTheDocument()
    expect(screen.queryByText('0 de 7 imágenes cargadas.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SIGUIENTE' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CANCELAR' })).toHaveAttribute('href', '/concesionaria/inventario')
  })

  it('validates only the current step and preserves values when going back', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(screen.getByRole('button', { name: 'SIGUIENTE' }))

    expect(screen.getByLabelText('Patente')).toHaveFocus()
    expect(screen.getByLabelText('Patente')).toHaveAccessibleDescription('Indicá la patente.')
    expect(screen.queryByText('Cargá al menos siete fotos.')).not.toBeInTheDocument()
    fill('Patente', 'AB123CD')
    fill('Marca', 'Toyota')
    fill('Modelo', 'Corolla')
    fill('Versión', 'XEI')
    fill('Año', '2021')
    await user.click(screen.getByRole('button', { name: 'SIGUIENTE' }))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByLabelText('Kilometraje')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Publicación' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'ANTERIOR' }))
    expect(screen.getByLabelText('Patente')).toHaveValue('AB123CD')
    expect(screen.getByRole('heading', { name: 'Identidad' })).toHaveFocus()
    expect(screen.queryByLabelText('Kilometraje')).not.toBeInTheDocument()
  })

  it('advances a native intermediate form submit without creating the vehicle', async () => {
    await renderPage()
    fill('Patente', 'AB123CD')
    fill('Marca', 'Toyota')
    fill('Modelo', 'Corolla')
    fill('Versión', 'XEI')
    fill('Año', '2021')
    fireEvent.submit(screen.getByLabelText('Año').closest('form')!)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2')
    expect(createVehicle).not.toHaveBeenCalled()
  })

  it('creates the vehicle and goes to the inventory with the success notice', async () => {
    vi.mocked(createVehicle).mockResolvedValue(vehiculo())
    await renderPage()
    const photos = await fillAndAddPhotos()
    await userEvent.setup().click(screen.getByRole('button', { name: 'ANTERIOR' }))
    expect(screen.getByLabelText('Android Auto o Apple CarPlay')).toHaveValue('0')
    await userEvent.setup().click(screen.getByRole('button', { name: 'SIGUIENTE' }))
    expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'GUARDAR VEHÍCULO' }))

    expect(await screen.findByText(/^Inventario:/)).toHaveTextContent('{"notice":"Cargaste el vehículo."}')
    expect(createVehicle).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(createVehicle).mock.calls[0][0]
    expect(sent.values.patente).toBe('AB123CD')
    expect(sent.values.acara_version_id).toBe('selected-corolla')
    expect(sent.newPhotos).toEqual(photos)
    expect(sent.removedPhotoIds).toEqual([])
  })

  it('stays on the form with the data when the save fails', async () => {
    vi.mocked(createVehicle).mockRejectedValue(new HttpError(500, undefined))
    await renderPage()
    await fillAndAddPhotos()

    await userEvent.setup().click(screen.getByRole('button', { name: 'GUARDAR VEHÍCULO' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos guardar el vehículo. Probá de nuevo.')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
    expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()
    expect(screen.queryByText(/^Inventario:/)).not.toBeInTheDocument()
  })

  it('returns a hidden server field error to its step and focuses it after rendering', async () => {
    vi.mocked(createVehicle).mockRejectedValue(new HttpError(422, { errors: { patente: ['Esa patente ya está cargada.'] } }))
    await renderPage()
    await fillAndAddPhotos()
    await userEvent.setup().click(screen.getByRole('button', { name: 'GUARDAR VEHÍCULO' }))

    expect(await screen.findByLabelText('Patente')).toHaveFocus()
    expect(screen.getByLabelText('Patente')).toHaveAccessibleDescription('Esa patente ya está cargada.')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
    fill('Patente', 'AB123CE')
    for (let index = 0; index < 4; index++) await userEvent.setup().click(screen.getByRole('button', { name: 'SIGUIENTE' }))
    expect(screen.getByText('7 imágenes cargadas.')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(7)
  })
})
