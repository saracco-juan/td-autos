import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { entry } from '../../test/comparison'
import ComparisonTable from './ComparisonTable'

const choose = (name: string) => fireEvent.click(screen.getAllByRole('tab', { name })[0])

it('HU08 RF07 TC-23 aligns current specifications, diagnosis factors and existing calculator totals', () => {
  render(<MemoryRouter><ComparisonTable entries={[entry(), entry(8)]} onRemove={vi.fn()} /></MemoryRouter>)
  const comparison = screen.getByRole('region', { name: 'Comparación de vehículos' })
  const cards = within(comparison).getAllByRole('article')
  expect(cards).toHaveLength(2)
  expect(cards[0]).toHaveAccessibleName('Toyota Corolla XEI 2021')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  const firstSpecifications = screen.getByRole('group', { name: 'Especificaciones de Toyota Corolla XEI 2021' })
  expect(within(cards[0]).queryByRole('term')).not.toBeInTheDocument()
  expect(within(firstSpecifications).getAllByRole('term').slice(0, 3).map((term) => term.firstChild?.textContent?.trim()))
    .toEqual(['Precio publicado', 'Coincidencia', 'Fuente'])
  const row = (label: string) => within(firstSpecifications).getByText(label, { exact: true }).closest('div')
  choose('Costos estimados en ARS')
  expect(row('Compra con transferencia')).toHaveTextContent('$ 29.500.000')
  expect(row('Total mensual')).toHaveTextContent('$ 200.000')
  expect(row('Total anual con service')).toHaveTextContent('$ 3.300.000')
  choose('Ventajas según tu diagnóstico')
  expect(row('Compatibilidad con tu uso')).toHaveTextContent('80/100')
  expect(row('Compatibilidad con tu prioridad')).toHaveTextContent('No disponible')
  choose('Motor y consumo')
  expect(row('Motor')).toHaveTextContent('2.0')
  choose('Seguridad')
  expect(row('Frenos ABS')).toHaveTextContent('No disponible')
  expect(screen.queryByRole('link', { name: /Ver cálculo completo/ })).not.toBeInTheDocument()
  choose('Costos estimados en ARS')
  expect(screen.getByRole('link', { name: 'Ver cálculo completo de Toyota Cronos XEI 2021' })).toHaveAttribute('href', '/vehiculos/8/costos')
  expect(screen.getByText(/No indican un ganador/)).toBeInTheDocument()
  choose('Información general')
  fireEvent.click(within(firstSpecifications).getByRole('button', { name: /^Sobre Transmisión/ }))
  expect(within(firstSpecifications).getByRole('tooltip')).toHaveTextContent('cambios de marcha')
})

it('HU08 TC-25 removes only the requested listing', () => {
  const remove = vi.fn()
  render(<MemoryRouter><ComparisonTable entries={[entry(), entry(8)]} onRemove={remove} /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Quitar Toyota Corolla XEI 2021' }))
  expect(remove).toHaveBeenCalledWith(7)
})

it('distinguishes unknown equipment, missing photos and partial costs without inventing zeroes', () => {
  const selected = entry()
  selected.detail.vehicle = { ...selected.detail.vehicle, fotos: [], frenos_abs: false }
  selected.costs.monthly.not_estimated = ['Combustible']
  render(<MemoryRouter><ComparisonTable entries={[selected, entry(8)]} onRemove={vi.fn()} /></MemoryRouter>)
  expect(screen.getByText('Fotos no disponibles.')).toBeInTheDocument()
  choose('Seguridad')
  expect(screen.getAllByText('Frenos ABS').map((label) => label.closest('div')?.querySelector('dd')?.textContent))
    .toEqual(['No', 'No disponible'])
  choose('Costos estimados en ARS')
  const first = screen.getByRole('group', { name: 'Especificaciones de Toyota Corolla XEI 2021' })
  expect(within(first).getByText('Costos no incluidos').closest('div')).toHaveTextContent('Combustible')
  expect(within(first).getByText('Total mensual').closest('div')).toHaveTextContent('parcial')
  fireEvent.error(screen.getByAltText('Foto de Toyota Cronos XEI 2021'))
  expect(screen.getAllByText('Fotos no disponibles.')).toHaveLength(2)
})

it('uses one shared tablist to switch both vehicle sections without changing selection', () => {
  const remove = vi.fn()
  render(<MemoryRouter><ComparisonTable entries={[entry(), entry(8)]} onRemove={remove} /></MemoryRouter>)
  expect(screen.getAllByRole('tablist')).toHaveLength(1)
  expect(screen.getAllByRole('tab', { name: 'Información general', selected: true })).toHaveLength(1)
  fireEvent.click(screen.getByRole('tab', { name: 'Motor y consumo' }))
  const panels = screen.getAllByRole('tabpanel', { name: 'Motor y consumo' })
  expect(panels).toHaveLength(1)
  expect(within(panels[0]).getAllByRole('group')).toHaveLength(2)
  for (const panel of panels) expect(within(panel).getAllByText('Motor', { exact: true })).toHaveLength(2)
  expect(screen.queryByText('Frenos ABS')).not.toBeInTheDocument()
  expect(screen.queryByText('Precio publicado')).not.toBeInTheDocument()
  expect(remove).not.toHaveBeenCalled()
})

it('hides matching known facts in both columns, keeps differences and missing data, and restores them', () => {
  const first = entry()
  const second = entry(8)
  first.detail.vehicle.frenos_abs = true
  second.detail.vehicle.frenos_abs = false
  first.detail.vehicle.airbags_laterales = true
  second.detail.vehicle.airbags_laterales = true
  render(<MemoryRouter><ComparisonTable entries={[first, second]} onRemove={vi.fn()} /></MemoryRouter>)
  choose('Seguridad')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar similitudes' }))
  const visibleTerms = () => screen.getAllByRole('term').map((term) => term.textContent)
  expect(visibleTerms()).not.toContain('Airbags laterales')
  expect(visibleTerms().filter((label) => label === 'Frenos ABS')).toHaveLength(2)
  expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
  choose('Costos estimados en ARS')
  expect(screen.getByRole('status')).toHaveTextContent('Todos los datos disponibles de esta sección coinciden.')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Ocultar similitudes' }))
  expect(screen.getAllByText('Total mensual')).toHaveLength(2)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  choose('Seguridad')
  expect(visibleTerms().filter((label) => label === 'Airbags laterales')).toHaveLength(2)
})
