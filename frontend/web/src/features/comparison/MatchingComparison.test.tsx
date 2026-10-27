import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { apiFetch } from '../../lib/http'
import { entry, recommendation } from '../../test/comparison'
import MatchingRecommendationsPage from '../recommendations/MatchingRecommendationsPage'
import ComparisonPage from './ComparisonPage'

vi.mock('../../lib/http', async (original) => ({ ...await original<object>(), apiFetch: vi.fn() }))
beforeEach(() => {
  vi.mocked(apiFetch).mockReset().mockImplementation(async (path) => {
    if (path === '/api/recomendaciones') return { status: 'ready', results: [7, 8, 9].map(recommendation), exchange_rate: null }
    const id = Number(path.split('/')[3])
    return path.endsWith('/costos') ? entry(id).costs : entry(id).detail
  })
})
const mount = (query = '') => render(<MemoryRouter initialEntries={[`/recomendaciones${query}`]}>
  <Routes>
    <Route path="/recomendaciones" element={<MatchingRecommendationsPage />} />
    <Route path="/comparar" element={<ComparisonPage />} />
  </Routes>
</MemoryRouter>)
const select = async (index: number) => userEvent.click((await screen.findAllByRole('button', { name: /^Comparar Toyota/ }))[index])

it('HU08 TC-23 selects two recommendations, compares them and preserves the existing detail shortcut', async () => {
  mount()
  expect((await screen.findAllByRole('link', { name: 'VER FICHA' }))[0]).toHaveAttribute('href', '/vehiculos/7')
  expect(screen.queryByRole('link', { name: 'CALCULAR COSTOS' })).not.toBeInTheDocument()
  await select(0)
  await select(0)
  await userEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  expect(await screen.findByRole('table')).toBeVisible()
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/7/costos')
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/8/costos')
})

it('HU08 TC-24 announces the third rejection and retains both selected vehicles', async () => {
  mount()
  await select(0)
  await select(0)
  await select(0)
  expect(screen.getByRole('alert')).toHaveTextContent('admite exactamente dos vehículos')
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2)
  await userEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('button', { name: /^Quitar / })).toHaveLength(2)
  expect(apiFetch).not.toHaveBeenCalledWith('/api/vehiculos/9/costos')
})

it('HU08 TC-76 requests completion for zero or one selection without leaving recommendations', async () => {
  mount()
  await screen.findByRole('list', { name: 'Recomendaciones' })
  await userEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Seleccioná exactamente dos vehículos')
  await select(0)
  await userEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(1)
})

it('HU08 TC-25 removes either selected vehicle, preserves filters and permits replacement', async () => {
  mount('?maxKilometers=70000')
  await select(0)
  await select(0)
  await userEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  await screen.findByRole('table')
  await userEvent.click(screen.getByRole('button', { name: 'Quitar Toyota Corolla XEI 2021' }))
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('link', { name: /Volver a recomendados/ }))
  expect(await screen.findByRole('button', { name: 'Quitar Toyota Cronos XEI 2021', pressed: true })).toBeVisible()
  await select(1)
  await userEvent.click(screen.getByRole('button', { name: 'COMPARAR' }))
  await screen.findByRole('table')
  expect(apiFetch).toHaveBeenCalledWith('/api/vehiculos/9/costos')
  expect(screen.getByRole('link', { name: /Volver a recomendados/ })).toHaveAttribute('href', expect.stringContaining('maxKilometers=70000'))
})
