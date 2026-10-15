import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, NetworkError } from '../../lib/http'
import { deleteVehicle, fetchVehicles } from './api'
import { VEHICULOS, vehiculo } from './fixtures'
import InventoryPage from './InventoryPage'

vi.mock('./api', () => ({ fetchVehicles: vi.fn(), deleteVehicle: vi.fn() }))

const COROLLA = 'Toyota Corolla XEI 2021'
const CRONOS = 'Fiat Cronos Drive 2022'

function renderPage() {
  render(
    <MemoryRouter>
      <InventoryPage />
    </MemoryRouter>,
  )
}

const rowOf = (title: string) => screen.getByRole('listitem', { name: title })
const rowGone = (title: string) => waitFor(() => expect(screen.queryByRole('listitem', { name: title })).not.toBeInTheDocument())

async function loaded() {
  renderPage()
  await screen.findByRole('list')
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.mocked(fetchVehicles).mockReset()
    vi.mocked(deleteVehicle).mockReset()
    vi.mocked(fetchVehicles).mockResolvedValue(VEHICULOS)
  })

  it('shows a section loader while the vehicles load', () => {
    vi.mocked(fetchVehicles).mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Cargando')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders the header, the automatic inclusion card and the load action of Figma 38:884', async () => {
    await loaded()

    expect(screen.getByRole('heading', { level: 1, name: 'Inventario' })).toBeInTheDocument()
    expect(screen.getByText('INVENTARIO')).toBeInTheDocument()
    expect(screen.getByText('Activa · funciones habilitadas')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Inclusión automática' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Las unidades guardadas participan directamente en búsquedas y recomendaciones. No hay publicación manual, pausa ni archivo de vigencia.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'CARGAR VEHÍCULO' })).toHaveAttribute('href', '/concesionaria/inventario/nuevo')
    expect(screen.getByRole('link', { name: 'IMPORTAR CSV' })).toHaveAttribute('href', '/concesionaria/inventario/importar')
  })

  it('S3: does not render SUSCRIPCIÓN, whose screen does not exist yet', async () => {
    await loaded()

    expect(screen.queryByText('SUSCRIPCIÓN')).not.toBeInTheDocument()
  })

  it('lists every vehicle with title, meta, EDITAR and ELIMINAR', async () => {
    await loaded()

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const corolla = within(rowOf(COROLLA))
    expect(corolla.getByText('AB123CD · 7 imágenes · 60.000 km · $ 18.500.000 · Córdoba')).toBeInTheDocument()
    expect(corolla.getByRole('link', { name: `Editar ${COROLLA}` })).toHaveAttribute('href', '/concesionaria/inventario/1/editar')
    expect(corolla.getByRole('button', { name: `Eliminar ${COROLLA}` })).toBeInTheDocument()
    expect(within(rowOf(CRONOS)).getByRole('link', { name: `Editar ${CRONOS}` })).toHaveAttribute(
      'href',
      '/concesionaria/inventario/2/editar',
    )
  })

  it('leaves the version out of the title of a vehicle without one', async () => {
    vi.mocked(fetchVehicles).mockResolvedValue([vehiculo({ version: null })])
    await loaded()

    expect(screen.getByRole('listitem', { name: 'Toyota Corolla 2021' })).toBeInTheDocument()
  })

  it('shows the empty state with the load action when there are no vehicles', async () => {
    vi.mocked(fetchVehicles).mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Todavía no cargaste vehículos.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'CARGAR VEHÍCULO' })).toHaveLength(1)
  })

  it.each([
    ['a network failure', new NetworkError(new Error('down')), 'Sin conexión con el servidor'],
    ['a server failure', new HttpError(500, undefined), 'Algo salió mal'],
  ])('shows the load error for %s and loads again on REINTENTAR', async (_label, failure, title) => {
    vi.mocked(fetchVehicles).mockRejectedValueOnce(failure)
    renderPage()

    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))

    expect(await screen.findByRole('list')).toBeInTheDocument()
    expect(fetchVehicles).toHaveBeenCalledTimes(2)
  })

  describe('delete', () => {
    type User = ReturnType<typeof userEvent.setup>
    const ask = (user: User, title = COROLLA) =>
      user.click(within(rowOf(title)).getByRole('button', { name: `Eliminar ${title}` }))
    const confirm = (user: User) => user.click(screen.getByRole('button', { name: 'ELIMINAR' }))

    it('turns the row into a confirmation and focuses its ELIMINAR button, without deleting yet', async () => {
      const user = userEvent.setup()
      await loaded()

      await ask(user)

      const row = within(rowOf(COROLLA))
      expect(row.getByText('¿Eliminar este vehículo? Se borran sus fotos y no se puede deshacer.')).toBeInTheDocument()
      expect(row.getByRole('button', { name: 'ELIMINAR' })).toHaveFocus()
      expect(row.getByRole('button', { name: 'CANCELAR' })).toBeInTheDocument()
      expect(row.queryByRole('link', { name: /Editar/ })).not.toBeInTheDocument()
      expect(deleteVehicle).not.toHaveBeenCalled()
      expect(within(rowOf(CRONOS)).queryByText(/¿Eliminar/)).not.toBeInTheDocument()
    })

    it('CANCELAR closes the confirmation, keeps the vehicle and returns the focus to its ELIMINAR button', async () => {
      const user = userEvent.setup()
      await loaded()
      await ask(user)

      await user.click(screen.getByRole('button', { name: 'CANCELAR' }))

      const row = within(rowOf(COROLLA))
      expect(row.queryByText(/¿Eliminar/)).not.toBeInTheDocument()
      expect(row.getByRole('button', { name: `Eliminar ${COROLLA}` })).toHaveFocus()
      expect(deleteVehicle).not.toHaveBeenCalled()
    })

    it('asking for another vehicle moves the confirmation to that row', async () => {
      const user = userEvent.setup()
      await loaded()
      await ask(user)

      await ask(user, CRONOS)

      expect(within(rowOf(COROLLA)).queryByText(/¿Eliminar/)).not.toBeInTheDocument()
      expect(within(rowOf(CRONOS)).getByText(/¿Eliminar/)).toBeInTheDocument()
    })

    it('deletes the vehicle, removes the row and shows a success message', async () => {
      const user = userEvent.setup()
      vi.mocked(deleteVehicle).mockResolvedValue(undefined)
      await loaded()
      await ask(user)

      await confirm(user)

      await rowGone(COROLLA)
      expect(deleteVehicle).toHaveBeenCalledWith(1)
      expect(screen.getByRole('status')).toHaveTextContent('Eliminaste el vehículo.')
      expect(screen.getByRole('listitem', { name: CRONOS })).toBeInTheDocument()
    })

    it('shows the busy state on the ELIMINAR button of that row only, while deleting', async () => {
      const user = userEvent.setup()
      let finish: () => void = () => {}
      vi.mocked(deleteVehicle).mockReturnValue(new Promise<void>((resolve) => (finish = resolve)))
      await loaded()
      await ask(user)

      await confirm(user)

      const row = within(rowOf(COROLLA))
      expect(row.getByRole('button', { name: 'ELIMINAR' })).toHaveAttribute('aria-busy', 'true')
      expect(row.getByRole('button', { name: 'ELIMINAR' })).toBeDisabled()
      expect(row.getByRole('button', { name: 'CANCELAR' })).toBeDisabled()
      expect(within(rowOf(CRONOS)).getByRole('button', { name: `Eliminar ${CRONOS}` })).toBeDisabled()
      expect(screen.getByRole('list')).not.toHaveAttribute('aria-busy')

      finish()
      await rowGone(COROLLA)
    })

    it('keeps the row, shows a filled error on it and focuses ELIMINAR again when the delete fails', async () => {
      const user = userEvent.setup()
      vi.mocked(deleteVehicle).mockRejectedValue(new HttpError(500, undefined))
      await loaded()
      await ask(user)

      await confirm(user)

      const row = within(rowOf(COROLLA))
      expect(await row.findByRole('alert')).toHaveTextContent('No pudimos eliminar el vehículo. Probá de nuevo.')
      expect(row.getByRole('button', { name: 'ELIMINAR' })).toBeEnabled()
      expect(row.getByRole('button', { name: 'ELIMINAR' })).toHaveFocus()
      expect(screen.queryByText('Eliminaste el vehículo.')).not.toBeInTheDocument()
    })

    it('can retry after a failure, and the error goes away', async () => {
      const user = userEvent.setup()
      vi.mocked(deleteVehicle)
        .mockRejectedValueOnce(new NetworkError(new Error('down')))
        .mockResolvedValueOnce(undefined)
      await loaded()
      await ask(user)
      await confirm(user)
      await screen.findByRole('alert')

      await confirm(user)

      await rowGone(COROLLA)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('treats a 404 as already deleted: the row goes away without an error', async () => {
      const user = userEvent.setup()
      vi.mocked(deleteVehicle).mockRejectedValue(new HttpError(404, { message: 'Not found' }))
      await loaded()
      await ask(user)

      await confirm(user)

      await rowGone(COROLLA)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows the empty state after the last vehicle is deleted', async () => {
      const user = userEvent.setup()
      vi.mocked(fetchVehicles).mockResolvedValue([vehiculo()])
      vi.mocked(deleteVehicle).mockResolvedValue(undefined)
      await loaded()
      await ask(user)

      await confirm(user)

      expect(await screen.findByText('Todavía no cargaste vehículos.')).toBeInTheDocument()
      expect(screen.getByText('Eliminaste el vehículo.')).toBeInTheDocument()
    })
  })
})

describe('InventoryPage save notice', () => {
  function LocationState() {
    return <output aria-label="location state">{JSON.stringify(useLocation().state)}</output>
  }

  function renderWithState(state: unknown) {
    vi.mocked(fetchVehicles).mockReset()
    vi.mocked(fetchVehicles).mockResolvedValue(VEHICULOS)
    render(
      <MemoryRouter initialEntries={[{ pathname: '/concesionaria/inventario', state }]}>
        <InventoryPage />
        <LocationState />
      </MemoryRouter>,
    )
  }

  it.each(['Cargaste el vehículo.', 'Guardaste los cambios.'])('shows the filled success message "%s" received from the form', async (notice) => {
    renderWithState({ notice })

    const message = await screen.findByText(notice)
    expect(message).toHaveAttribute('role', 'status')
    expect(message).toHaveFocus()
  })

  it('clears the navigation state so a reload does not show the message again', async () => {
    renderWithState({ notice: 'Cargaste el vehículo.' })
    await screen.findByText('Cargaste el vehículo.')

    await waitFor(() => expect(screen.getByLabelText('location state')).toHaveTextContent('null'))
    expect(screen.getByText('Cargaste el vehículo.')).toBeInTheDocument()
  })

  it('shows no message when the list is opened without state', async () => {
    renderWithState(undefined)
    await screen.findByRole('list')

    expect(screen.queryByText('Cargaste el vehículo.')).not.toBeInTheDocument()
    expect(screen.queryByText('Guardaste los cambios.')).not.toBeInTheDocument()
  })

  it('ignores a state that is not a notice', async () => {
    renderWithState({ notice: 42, other: 'x' })
    await screen.findByRole('list')

    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })
})
