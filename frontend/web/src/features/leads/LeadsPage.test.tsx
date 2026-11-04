import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch, NetworkError } from '../../lib/http'
import LeadsPage from './LeadsPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<typeof import('../../lib/http')>(), apiFetch: vi.fn() }))

const summary = { period: 'month', total: 3, vehicles: [
  { id: 1, label: 'Toyota Corolla XEI 2021', leads: 2 },
  { id: 2, label: 'Ford Focus 2020', leads: 1 },
  { id: 3, label: 'Fiat Cronos 2022', leads: 0 },
] }

beforeEach(() => vi.mocked(apiFetch).mockReset())

it('TC-67 shows the period total and ordered vehicle bars, including zero contacts', async () => {
  vi.mocked(apiFetch).mockResolvedValue(summary)
  render(<LeadsPage />)
  expect(await screen.findByLabelText('Total de contactos')).toHaveTextContent('3')
  expect(apiFetch).toHaveBeenCalledWith('/api/concesionaria/leads?period=month')
  const rows = within(screen.getByRole('list', { name: 'Vehículos por contactos' })).getAllByRole('listitem')
  expect(rows.map((row) => row.textContent)).toEqual([
    'Toyota Corolla XEI 20212 contactos', 'Ford Focus 20201 contacto', 'Fiat Cronos 20220 contactos',
  ])
  expect(screen.getByRole('meter', { name: 'Contactos de Toyota Corolla XEI 2021' })).toHaveAttribute('value', '2')
  expect(screen.getByRole('meter', { name: 'Contactos de Ford Focus 2020' })).toHaveAttribute('max', '2')
  expect(screen.getByText(/No confirma mensajes enviados/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
  await screen.findByLabelText('Total de contactos')
  expect(apiFetch).toHaveBeenLastCalledWith('/api/concesionaria/leads?period=week')
  expect(screen.getByRole('button', { name: 'Esta semana' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Todo el período' }))
  await screen.findByLabelText('Total de contactos')
  expect(apiFetch).toHaveBeenLastCalledWith('/api/concesionaria/leads?period=all')
})

it('TC-68 shows zero and a clear empty state without a chart', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ period: 'month', total: 0, vehicles: [] })
  render(<LeadsPage />)
  expect(await screen.findByLabelText('Total de contactos')).toHaveTextContent('0')
  expect(screen.getByText('Sin contactos en este período')).toBeInTheDocument()
  expect(screen.queryByRole('list')).not.toBeInTheDocument()
})

it('keeps loading local, retries failures, and ignores an old period response', async () => {
  let resolveOld!: (value: typeof summary) => void
  vi.mocked(apiFetch).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    .mockRejectedValueOnce(new NetworkError('offline')).mockResolvedValue(summary)
  render(<LeadsPage />)
  expect(screen.getByRole('heading', { level: 1, name: 'Métricas' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Cargando')
  await userEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
  await userEvent.click(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByLabelText('Total de contactos')).toHaveTextContent('3')
  await act(async () => resolveOld({ ...summary, total: 99 }))
  expect(screen.getByLabelText('Total de contactos')).toHaveTextContent('3')
})

it('paginates a long ranking without changing the overall total', async () => {
  vi.mocked(apiFetch).mockResolvedValue({ ...summary, total: 12, vehicles: Array.from({ length: 12 }, (_, id) => ({ id, label: `Auto ${id}`, leads: 1 })) })
  render(<LeadsPage />)
  expect(await screen.findByLabelText('Total de contactos')).toHaveTextContent('12')
  expect(screen.getAllByRole('listitem')).toHaveLength(12) // 10 vehicles and two page buttons
  await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))
  expect(screen.getByText('Auto 10')).toBeInTheDocument()
  expect(screen.queryByText('Auto 0')).not.toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Mostrar'), '25')
  expect(screen.getByText('Auto 0')).toBeInTheDocument()
  expect(screen.getByText('Auto 11')).toBeInTheDocument()
})
