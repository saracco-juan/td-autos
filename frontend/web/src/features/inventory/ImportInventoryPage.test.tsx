import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { confirmImport, previewImport } from './api'
import { inactiveBody } from './fixtures'
import ImportInventoryPage from './ImportInventoryPage'

vi.mock('./api', () => ({ previewImport: vi.fn(), confirmImport: vi.fn() }))

type Counts = { nuevos: number; actualizaciones: number }

function Inventory() {
  const location = useLocation()
  return <p>Inventario: {JSON.stringify(location.state)}</p>
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/concesionaria/inventario/importar']}>
      <Routes>
        <Route path="/concesionaria/inventario/importar" element={<ImportInventoryPage />} />
        <Route path="/concesionaria/inventario" element={<Inventory />} />
      </Routes>
    </MemoryRouter>,
  )
}

const CSV = new File(['patente;marca'], 'stock.csv', { type: 'text/csv' })
const OTHER = new File(['x'], 'otro.csv', { type: 'text/csv' })
const ROW_ERRORS = {
  message: 'El archivo tiene errores. No se aplicó ningún cambio.',
  errores: [
    { fila: 2, patente: 'AB123CD', mensajes: ['El año no es válido.', 'Faltan fotos.'] },
    { fila: 4, patente: null, mensajes: ['La patente es obligatoria.'] },
  ],
}

const pick = (file: File = CSV) => userEvent.setup().upload(screen.getByLabelText('Archivo CSV'), file)
const confirmButton = () => screen.getByRole('button', { name: /CONFIRMAR IMPORTACIÓN|IMPORTANDO/ })
const previewHeading = () => screen.queryByRole('heading', { name: 'Vista previa' })

async function previewed(counts: Counts = { nuevos: 3, actualizaciones: 1 }) {
  vi.mocked(previewImport).mockResolvedValue(counts)
  renderPage()
  await pick()
  await screen.findByRole('heading', { name: 'Vista previa' })
}

describe('ImportInventoryPage', () => {
  beforeEach(() => {
    vi.mocked(previewImport).mockReset()
    vi.mocked(confirmImport).mockReset()
  })

  it('renders the header, the format card and the actions of Figma 38:1005', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Volver al inventario' })).toHaveAttribute('href', '/concesionaria/inventario')
    expect(screen.getByText('INVENTARIO')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Importar CSV' })).toBeInTheDocument()
    expect(screen.getByText('Subí un archivo para cargar o actualizar varios vehículos a la vez.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Formato del archivo' })).toBeInTheDocument()
    expect(screen.getByText(/Cada fila necesita patente, marca, modelo, año y al menos 7 URLs de imágenes públicas/)).toBeInTheDocument()
    expect(screen.getByText(/separadas por \|/)).toBeInTheDocument()
    expect(screen.getByText(/CV, HP o kW/)).toBeInTheDocument()
    expect(screen.getByText(/L\/100 km/)).toBeInTheDocument()
    expect(screen.getByText(/Vacío no significa no/)).toBeInTheDocument()
    expect(screen.getByText(/datos ficticios/)).toBeInTheDocument()
    expect(screen.getByText('Ningún archivo seleccionado')).toBeInTheDocument()
    expect(screen.getByText('SELECCIONAR ARCHIVO')).toBeInTheDocument()
    expect(screen.getByLabelText('Archivo CSV')).toHaveAttribute('accept', '.csv,text/csv')
    expect(screen.getByRole('link', { name: 'VOLVER AL INVENTARIO' })).toHaveAttribute('href', '/concesionaria/inventario')
    expect(confirmButton()).toBeDisabled()
    expect(previewHeading()).not.toBeInTheDocument()
  })

  it('explains an inactive subscription in a compact box with a way to renew when the preview is refused', async () => {
    const body = inactiveBody()
    vi.mocked(previewImport).mockRejectedValue(new HttpError(403, body))
    renderPage()

    await pick()

    expect(await screen.findByRole('alert')).toHaveTextContent(body.message)
    expect(screen.getByRole('link', { name: 'RENOVAR SUSCRIPCIÓN' })).toHaveAttribute('href', '/concesionaria/suscripcion')
    expect(screen.queryByText('Tu inventario está pausado')).not.toBeInTheDocument()
    expect(screen.queryByText('No pudimos procesar el archivo. Probá de nuevo.')).not.toBeInTheDocument()
  })

  it('offers the CSV template as a download in the format card', () => {
    renderPage()

    const template = screen.getByRole('link', { name: 'DESCARGAR PLANTILLA' })
    expect(template).toHaveAttribute('href', '/plantilla-inventario.csv')
    expect(template).toHaveAttribute('download', 'plantilla-inventario.csv')
  })

  it('previews the file as soon as it is picked, with a loader on the preview card only', async () => {
    let resolve: (value: Counts) => void = () => {}
    vi.mocked(previewImport).mockReturnValue(new Promise((done) => (resolve = done)))
    renderPage()

    await pick()

    expect(previewImport).toHaveBeenCalledWith(CSV)
    expect(screen.getByText('stock.csv')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(confirmButton()).toBeDisabled()

    resolve({ nuevos: 3, actualizaciones: 2 })

    expect(
      await screen.findByText('3 vehículos nuevos · 2 actualizaciones · 0 errores. No se aplica ningún cambio hasta confirmar.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Vista previa' })).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
  })

  it('uses the singular in the preview', async () => {
    await previewed({ nuevos: 1, actualizaciones: 1 })

    expect(screen.getByText(/^1 vehículo nuevo · 1 actualización · 0 errores/)).toBeInTheDocument()
  })

  it('lists every row error and keeps the confirm button disabled', async () => {
    vi.mocked(previewImport).mockRejectedValue(new HttpError(422, ROW_ERRORS))
    renderPage()

    await pick()

    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo tiene errores. No se aplicó ningún cambio.')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Fila 2 · AB123CD: El año no es válido.',
      'Fila 2 · AB123CD: Faltan fotos.',
      'Fila 4: La patente es obligatoria.',
    ])
    expect(previewHeading()).not.toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
  })

  it('shows the message of a file-level error', async () => {
    vi.mocked(previewImport).mockRejectedValue(
      new HttpError(422, { message: 'x', errors: { archivo: ['El archivo supera el máximo de 500 filas.'] } }),
    )
    renderPage()

    await pick()

    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo supera el máximo de 500 filas.')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
  })

  it('shows the connection copy on a network failure and the generic copy on a server failure', async () => {
    vi.mocked(previewImport).mockRejectedValueOnce(new NetworkError(new Error('down')))
    renderPage()

    await pick()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.')

    vi.mocked(previewImport).mockRejectedValueOnce(new HttpError(500, undefined))
    await pick(OTHER)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No pudimos procesar el archivo. Probá de nuevo.'))
  })

  it('a new selection resets the previous result', async () => {
    await previewed()

    vi.mocked(previewImport).mockRejectedValueOnce(new HttpError(422, ROW_ERRORS))
    await pick(OTHER)

    await screen.findByRole('alert')
    expect(previewHeading()).not.toBeInTheDocument()
    expect(screen.getByText('otro.csv')).toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
  })

  it('ignores the answer of a file that is no longer the selected one', async () => {
    let resolveFirst: (value: Counts) => void = () => {}
    vi.mocked(previewImport).mockReturnValueOnce(new Promise((done) => (resolveFirst = done)))
    vi.mocked(previewImport).mockResolvedValueOnce({ nuevos: 7, actualizaciones: 0 })
    renderPage()
    await pick()
    await pick(OTHER)
    await screen.findByText(/^7 vehículos nuevos/)

    resolveFirst({ nuevos: 1, actualizaciones: 1 })

    await waitFor(() => expect(screen.getByText(/^7 vehículos nuevos/)).toBeInTheDocument())
  })

  it('confirms with the same file and goes back to the inventory with a notice', async () => {
    let resolve: (value: Counts) => void = () => {}
    vi.mocked(confirmImport).mockReturnValue(new Promise((done) => (resolve = done)))
    await previewed()

    await userEvent.setup().click(confirmButton())

    expect(confirmImport).toHaveBeenCalledWith(CSV)
    expect(confirmButton()).toBeDisabled()
    expect(confirmButton()).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByLabelText('Archivo CSV')).toBeDisabled()

    resolve({ nuevos: 3, actualizaciones: 1 })

    expect(await screen.findByText(/^Inventario:/)).toHaveTextContent(
      JSON.stringify({ notice: 'Importación aplicada: 3 vehículos nuevos y 1 actualizado.' }),
    )
  })

  it.each([
    [1, 0, 'Importación aplicada: 1 vehículo nuevo.'],
    [0, 1, 'Importación aplicada: 1 vehículo actualizado.'],
    [0, 4, 'Importación aplicada: 4 vehículos actualizados.'],
  ])('words the notice for %i new and %i updated', async (nuevos, actualizaciones, notice) => {
    vi.mocked(confirmImport).mockResolvedValue({ nuevos, actualizaciones })
    await previewed({ nuevos, actualizaciones })

    await userEvent.setup().click(confirmButton())

    expect(await screen.findByText(/^Inventario:/)).toHaveTextContent(JSON.stringify({ notice }))
  })

  it('a 422 at confirm shows the errors, drops the preview and stays on the page', async () => {
    vi.mocked(confirmImport).mockRejectedValue(new HttpError(422, ROW_ERRORS))
    await previewed()

    await userEvent.setup().click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo tiene errores.')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(previewHeading()).not.toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    expect(screen.getByRole('heading', { level: 1, name: 'Importar CSV' })).toBeInTheDocument()
  })

  it('a network failure at confirm keeps the preview so the dealer can retry', async () => {
    vi.mocked(confirmImport).mockRejectedValue(new NetworkError(new Error('down')))
    await previewed()

    await userEvent.setup().click(confirmButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos conectarnos')
    expect(previewHeading()).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
  })
})
