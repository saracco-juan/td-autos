import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { fetchInspections } from '../../../features/inspection/api/client'
import { fetchTransfer } from '../../../features/transfer/api/client'
import PurchaseProgress from '../../../features/profile/components/PurchaseProgress'

vi.mock('../../../features/inspection/api/client', () => ({ fetchInspections: vi.fn() }))
vi.mock('../../../features/transfer/api/client', () => ({ fetchTransfer: vi.fn() }))

const steps = [{ numero: 1, titulo: 'Papeles', ayuda: null, items: [
  { codigo: 'a', texto: 'Uno', critico: false },
  { codigo: 'b', texto: 'Dos', critico: false },
] }]

beforeEach(() => {
  vi.mocked(fetchInspections).mockResolvedValue({ pasos: steps, inspecciones: [] })
  vi.mocked(fetchTransfer).mockResolvedValue({ etapas: [], estado: null, items_completados: [], asesor_whatsapp: null })
})

function mount() {
  render(<MemoryRouter><PurchaseProgress /></MemoryRouter>)
}

it('uses saved marks and catalog totals and links to the inspected vehicle', async () => {
  vi.mocked(fetchInspections).mockResolvedValue({ pasos: steps, inspecciones: [{
    vehiculo: { id: 7, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021 },
    estado: 'en_curso', items_completados: ['a', 'a', 'obsolete'],
  }] })
  vi.mocked(fetchTransfer).mockResolvedValue({
    etapas: [{ ...steps[0], items: steps[0].items.map(item => ({ ...item, obligatorio: false })) }],
    estado: 'en_curso', items_completados: ['a', 'b'], asesor_whatsapp: null,
  })
  mount()

  const inspection = await screen.findByRole('progressbar', { name: 'Inspección · Toyota Corolla XEI 2021' })
  expect(inspection).toHaveAttribute('aria-valuenow', '50')
  expect(screen.getByRole('heading', { name: 'Inspección · Toyota Corolla 2021' })).toBeInTheDocument()
  expect(screen.getByText('XEI')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Transferencia' })).toHaveAttribute('aria-valuenow', '100')
  expect(screen.getByRole('link', { name: 'CONTINUAR INSPECCIÓN' })).toHaveAttribute('href', '/vehiculos/7/inspeccion')
  expect(screen.getByRole('link', { name: 'VER TRANSFERENCIA' })).toHaveAttribute('href', '/transferencia')
})

it('explains an empty inspection history and offers transfer without fabricated progress', async () => {
  mount()
  expect(await screen.findByText('Todavía no empezaste una inspección.')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Transferencia' })).toHaveAttribute('aria-valuenow', '0')
  expect(screen.getByRole('link', { name: 'EMPEZAR TRANSFERENCIA' })).toBeInTheDocument()
})

it('keeps transfer usable when inspection progress cannot be loaded', async () => {
  vi.mocked(fetchInspections).mockRejectedValue(new Error('offline'))
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus inspecciones.')
  expect(await screen.findByRole('link', { name: 'EMPEZAR TRANSFERENCIA' })).toBeInTheDocument()
})

it('keeps saved inspection usable when transfer fails and retries without changing saved marks', async () => {
  vi.mocked(fetchInspections).mockResolvedValue({ pasos: steps, inspecciones: [{
    vehiculo: { id: 7, marca: 'Toyota', modelo: 'Corolla', version: 'XEI', anio: 2021 },
    estado: 'en_curso', items_completados: ['a'],
  }] })
  vi.mocked(fetchTransfer).mockRejectedValueOnce(new Error('offline'))
  mount()

  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu transferencia.')
  expect(screen.getByRole('progressbar', { name: 'Inspección · Toyota Corolla XEI 2021' })).toHaveAttribute('aria-valuenow', '50')
  expect(screen.getByRole('link', { name: 'CONTINUAR INSPECCIÓN' })).toHaveAttribute('href', '/vehiculos/7/inspeccion')
  await userEvent.setup().click(screen.getByRole('button', { name: 'REINTENTAR' }))
  expect(await screen.findByRole('link', { name: 'EMPEZAR TRANSFERENCIA' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Inspección · Toyota Corolla XEI 2021' })).toHaveAttribute('aria-valuenow', '50')
})

it('keeps transfer usable when the inspection loader throws synchronously', async () => {
  vi.mocked(fetchInspections).mockImplementationOnce(() => { throw new Error('loader failed') })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus inspecciones.')
  expect(screen.getByRole('link', { name: 'EMPEZAR TRANSFERENCIA' })).toBeInTheDocument()
})

it('keeps inspections usable when the transfer loader throws synchronously', async () => {
  vi.mocked(fetchTransfer).mockImplementationOnce(() => { throw new Error('loader failed') })
  mount()
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu transferencia.')
  expect(screen.getByText('Todavía no empezaste una inspección.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'REINTENTAR' })).toBeEnabled()
})
