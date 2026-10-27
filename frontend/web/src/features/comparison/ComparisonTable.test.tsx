import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { entry } from '../../test/comparison'
import ComparisonTable from './ComparisonTable'

it('HU08 RF07 TC-23 aligns current specifications, diagnosis factors and existing calculator totals', () => {
  render(<MemoryRouter><ComparisonTable entries={[entry(), entry(8)]} onRemove={vi.fn()} /></MemoryRouter>)
  const comparison = screen.getByRole('region', { name: 'Comparación de vehículos' })
  const cards = within(comparison).getAllByRole('article')
  expect(cards).toHaveLength(2)
  expect(cards[0]).toHaveAccessibleName('Toyota Corolla XEI 2021')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(within(cards[0]).getAllByRole('term').slice(0, 8).map((term) => term.firstChild?.textContent?.trim()))
    .toEqual(['Precio publicado', 'Coincidencia', 'Año', 'Kilometraje', 'Transmisión', 'Combustible', 'Ubicación', 'Fuente'])
  const row = (label: string) => within(cards[0]).getByText(label, { exact: true }).closest('div')
  expect(row('Compra con transferencia')).toHaveTextContent('$ 29.500.000')
  expect(row('Total mensual')).toHaveTextContent('$ 200.000')
  expect(row('Total anual con service')).toHaveTextContent('$ 3.300.000')
  expect(row('Compatibilidad con tu uso')).toHaveTextContent('80/100')
  expect(row('Compatibilidad con tu prioridad')).toHaveTextContent('No disponible')
  expect(row('Motor')).toHaveTextContent('2.0')
  expect(row('Frenos ABS')).toHaveTextContent('No disponible')
  expect(screen.getAllByRole('link', { name: 'VER CÁLCULO COMPLETO' })[1]).toHaveAttribute('href', '/vehiculos/8/costos')
  expect(screen.getByText(/No indican un ganador/)).toBeInTheDocument()
  fireEvent.click(within(cards[0]).getByRole('button', { name: /^Sobre Transmisión/ }))
  expect(within(cards[0]).getByRole('tooltip')).toHaveTextContent('cambios de marcha')
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
  expect(screen.getAllByText('Frenos ABS').map((label) => label.closest('div')?.querySelector('dd')?.textContent))
    .toEqual(['No', 'No disponible'])
  const first = screen.getAllByRole('article')[0]
  expect(within(first).getByText('Costos no incluidos').closest('div')).toHaveTextContent('Combustible')
  expect(within(first).getByText('Total mensual').closest('div')).toHaveTextContent('parcial')
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getAllByText('Fotos no disponibles.')).toHaveLength(2)
})
