import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { fetchBodyTypes, fetchVehicle, fetchVehicleCatalog, updateVehicle } from './api'
import EditVehiclePage from './EditVehiclePage'
import { PAUSED_HINT, PAUSED_TEXT, inactiveBody, vehiculo } from './fixtures'

vi.mock('./api', () => ({ fetchVehicle: vi.fn(), updateVehicle: vi.fn(), fetchBodyTypes: vi.fn(), fetchVehicleCatalog: vi.fn() }))

function Inventory() {
  const location = useLocation()
  return <p>Inventario: {JSON.stringify(location.state)}</p>
}

function renderPage(path = '/concesionaria/inventario/1/editar') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/concesionaria/inventario/:id/editar" element={<EditVehiclePage />} />
        <Route path="/concesionaria/inventario" element={<Inventory />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('EditVehiclePage', () => {
  beforeEach(() => {
    vi.mocked(fetchVehicle).mockReset()
    vi.mocked(updateVehicle).mockReset()
    vi.mocked(fetchBodyTypes).mockReset()
    vi.mocked(fetchVehicleCatalog).mockResolvedValue({ snapshot_id: 'test', source_date: null, stale: false, warning: null, entries: [] })
    vi.mocked(fetchBodyTypes).mockResolvedValue([
      { id: 1, nombre: 'Hatchback' },
      { id: 2, nombre: 'Sedán' },
    ])
    vi.mocked(fetchVehicle).mockResolvedValue(vehiculo({ version: 'XEI', acara_version_id: 'selected-corolla', descripcion: 'Único dueño' }))
  })

  it('shows a centered section loader while the vehicle loads', () => {
    vi.mocked(fetchVehicle).mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.queryByLabelText('Patente')).not.toBeInTheDocument()
    expect(fetchVehicle).toHaveBeenCalledWith(1)
  })

  it('renders the header of Figma 2119:1841 and the form prefilled with the saved photos', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Editar vehículo' })).toBeInTheDocument()
    expect(screen.getByText('INVENTARIO')).toBeInTheDocument()
    expect(screen.getByText('La patente debe ser única en toda la plataforma.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Volver al inventario' })).toHaveAttribute('href', '/concesionaria/inventario')
    expect(await screen.findByLabelText('Patente')).toHaveValue('AB123CD')
    expect(screen.getByLabelText('Marca')).toHaveValue('Toyota')
    expect(screen.getByLabelText('Versión')).toHaveValue('XEI')
    expect(screen.getByLabelText('Carrocería')).toHaveValue('2')
    expect(screen.getAllByRole('img')).toHaveLength(7)
    expect(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CANCELAR' })).toHaveAttribute('href', '/concesionaria/inventario')
  })

  it('saves the changes and goes to the inventory with the success notice', async () => {
    vi.mocked(updateVehicle).mockResolvedValue(vehiculo())
    renderPage()
    const user = userEvent.setup()
    await screen.findByLabelText('Patente')
    fireEvent.change(screen.getByLabelText('Precio'), { target: { value: '17000000' } })
    await user.click(screen.getByRole('button', { name: 'Quitar foto 7' }))
    await user.upload(screen.getByLabelText('AGREGAR IMAGEN'), [new File(['x'], 'nueva.jpg', { type: 'image/jpeg' })])

    await user.click(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))

    expect(await screen.findByText(/^Inventario:/)).toHaveTextContent('{"notice":"Guardaste los cambios."}')
    expect(updateVehicle).toHaveBeenCalledTimes(1)
    const [id, sent] = vi.mocked(updateVehicle).mock.calls[0]
    expect(id).toBe(1)
    expect(sent.values.precio).toBe('17000000')
    expect(sent.newPhotos).toHaveLength(1)
    expect(sent.removedPhotoIds).toEqual([7])
  })

  it('RF22: repairs a legacy vehicle with no body type without losing its photos', async () => {
    vi.mocked(fetchVehicle).mockResolvedValue(vehiculo({ carroceria: null, acara_version_id: 'selected-corolla' }))
    vi.mocked(updateVehicle).mockResolvedValue(vehiculo())
    renderPage()
    const user = userEvent.setup()
    expect(await screen.findByLabelText('Carrocería')).toHaveValue('')
    expect(screen.getAllByRole('img')).toHaveLength(7)
    await user.click(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))
    expect(screen.getByText('Elegí la carrocería.')).toBeInTheDocument()
    expect(updateVehicle).not.toHaveBeenCalled()
    await user.selectOptions(screen.getByLabelText('Carrocería'), '2')
    await user.click(screen.getByRole('button', { name: 'GUARDAR CAMBIOS' }))
    expect(await screen.findByText(/^Inventario:/)).toHaveTextContent('Guardaste los cambios.')
    expect(vi.mocked(updateVehicle).mock.calls[0][1]).toMatchObject({
      values: { carroceria_id: '2' }, newPhotos: [], removedPhotoIds: [],
    })
  })

  it('shows the paused card under its own header when the subscription is inactive', async () => {
    vi.mocked(fetchVehicle).mockRejectedValue(new HttpError(403, inactiveBody()))
    renderPage()

    expect(await screen.findByRole('heading', { level: 2, name: 'Tu inventario está pausado' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Editar vehículo' })).toBeInTheDocument()
    expect(screen.getByText(PAUSED_TEXT)).toBeInTheDocument()
    expect(screen.getByText(PAUSED_HINT)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'RENOVAR SUSCRIPCIÓN' })).toHaveAttribute('href', '/concesionaria/suscripcion')
    expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument()
  })

  it('tells the dealer when the vehicle is not theirs or does not exist, with a way back', async () => {
    vi.mocked(fetchVehicle).mockRejectedValue(new HttpError(404, { message: 'No query results' }))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos ese vehículo.')
    expect(screen.getByRole('link', { name: 'Volver al inventario' })).toHaveAttribute('href', '/concesionaria/inventario')
    expect(screen.queryByLabelText('Patente')).not.toBeInTheDocument()
  })

  it('treats an id that cannot be a vehicle as not found without asking the server', async () => {
    renderPage('/concesionaria/inventario/abc/editar')

    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos ese vehículo.')
    expect(fetchVehicle).not.toHaveBeenCalled()
  })

  it('offers a retry on a network failure and loads the form once the server answers', async () => {
    vi.mocked(fetchVehicle).mockRejectedValueOnce(new NetworkError(new Error('down')))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión con el servidor')
    await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByLabelText('Patente')).toHaveValue('AB123CD')
    expect(fetchVehicle).toHaveBeenCalledTimes(2)
  })

  it('shows the server error state on any other failure', async () => {
    vi.mocked(fetchVehicle).mockRejectedValue(new HttpError(500, undefined))
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal')
  })
})
