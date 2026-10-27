import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { entry } from '../../test/comparison'
import ComparisonTable from './ComparisonTable'

it('HU08 RF07 TC-23 aligns current specifications, diagnosis factors and existing calculator totals', () => {
  render(<MemoryRouter><ComparisonTable entries={[entry(), entry(8)]} onRemove={vi.fn()} /></MemoryRouter>)
  const table = screen.getByRole('table', { name: 'Comparación de vehículos' })
  const rows = within(table).getAllByRole('row')
  const row = (label: string) => rows.find((item) => {
    const header = item.querySelector('th[scope="row"]')
    return header?.textContent?.startsWith(label)
  })
  expect(within(rows[0]).getAllByRole('columnheader')).toHaveLength(3)
  expect(row('Compra con transferencia')).toHaveTextContent('$ 29.500.000')
  expect(row('Total mensual')).toHaveTextContent('$ 200.000')
  expect(row('Total anual con service')).toHaveTextContent('$ 3.300.000')
  expect(row('Compatibilidad con tu uso')).toHaveTextContent('80/100')
  expect(row('Compatibilidad con tu prioridad')).toHaveTextContent('No disponible')
  expect(row('Motor')).toHaveTextContent('2.0')
  expect(row('Frenos ABS')).toHaveTextContent('No disponible')
  expect(screen.getAllByRole('link', { name: 'VER CÁLCULO COMPLETO' })[1]).toHaveAttribute('href', '/vehiculos/8/costos')
  expect(screen.getByText(/No indican un ganador/)).toBeInTheDocument()
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
  expect(within(screen.getByRole('row', { name: /Frenos ABS/ })).getAllByRole('cell').map((cell) => cell.textContent))
    .toEqual(['No', 'No disponible'])
  expect(screen.getByRole('row', { name: /Costos no incluidos/ })).toHaveTextContent('Combustible')
  expect(screen.getByRole('row', { name: /Total mensual/ })).toHaveTextContent('parcial')
  fireEvent.error(screen.getByRole('img'))
  expect(screen.getAllByText('Fotos no disponibles.')).toHaveLength(2)
})
