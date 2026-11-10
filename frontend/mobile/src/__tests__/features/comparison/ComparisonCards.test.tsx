import { fireEvent, render, screen, within } from '@testing-library/react-native'

import { vehicle } from '@shared/vehicles/fixtures'
import type { ComparisonEntry } from '@shared/comparison/groups'
import ComparisonCards from '../../../features/comparison/ComparisonCards'
import { costs } from '../../../test-utils/costs'
import { recommendation } from '../../../test-utils/recommendations'

const entry = (id: number): ComparisonEntry => ({
  id,
  detail: { vehicle: { ...vehicle, id }, dealer: { id: 2, nombre: 'Autos Sur', provincia: 'CABA' } },
  recommendation: recommendation(id),
  costs: costs(),
})

describe('HU08 native comparison cards', () => {
  it('TC-23 shows current facts and synchronizes the six sections without changing the pair', async () => {
    const remove = jest.fn()
    await render(<ComparisonCards entries={[entry(7), entry(8)]} onRemove={remove} onCosts={jest.fn()} />)
    const cards = screen.getAllByLabelText(/^Vehículo comparado:/)
    expect(cards).toHaveLength(2)
    for (const card of cards) {
      expect(within(card).getByText('$ 28.900.000')).toBeOnTheScreen()
      expect(within(card).getByRole('tab', { name: 'Información general' })).toBeSelected()
    }
    await fireEvent.press(within(cards[1]).getByRole('tab', { name: 'Ventajas según tu diagnóstico' }))
    for (const card of cards) {
      expect(within(card).getByText('Compatibilidad con tu uso')).toBeOnTheScreen()
      expect(within(card).getByRole('tab', { name: 'Ventajas según tu diagnóstico' })).toBeSelected()
    }
    await fireEvent.press(screen.getAllByRole('tab', { name: 'Costos estimados en ARS' })[0])
    expect(screen.getAllByText('$ 236.000')).toHaveLength(2)
    expect(screen.getAllByText('$ 20.700.000')).toHaveLength(2)
    expect(remove).not.toHaveBeenCalled()
  })

  it('TC-25 removes only the requested vehicle and opens its existing calculator', async () => {
    const remove = jest.fn()
    const open = jest.fn()
    await render(<ComparisonCards entries={[entry(7), entry(8)]} onRemove={remove} onCosts={open} />)
    await fireEvent.press(screen.getAllByRole('button', { name: 'QUITAR' })[1])
    expect(remove).toHaveBeenCalledWith(8)
    await fireEvent.press(screen.getAllByRole('button', { name: 'VER CÁLCULO COMPLETO' })[0])
    expect(open).toHaveBeenCalledWith(7)
  })

  it('keeps unknown facts, missing photos and partial estimates explicit', async () => {
    const first = entry(7)
    first.detail.vehicle = { ...first.detail.vehicle, fotos: [], frenos_abs: false }
    first.costs.monthly.not_estimated = ['Combustible']
    await render(<ComparisonCards entries={[first, entry(8)]} onRemove={jest.fn()} onCosts={jest.fn()} />)
    expect(screen.getByText('Fotos no disponibles.')).toBeOnTheScreen()
    await fireEvent.press(screen.getAllByRole('tab', { name: 'Seguridad' })[0])
    expect(screen.getByText('No')).toBeOnTheScreen()
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
    await fireEvent.press(screen.getAllByRole('tab', { name: 'Costos estimados en ARS' })[0])
    expect(screen.getByText('$ 236.000 (parcial)')).toBeOnTheScreen()
    expect(screen.getByText('Combustible')).toBeOnTheScreen()
  })
})

