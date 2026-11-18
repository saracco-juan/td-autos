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
    const changeVehicle = jest.fn()
    await render(<ComparisonCards entries={[entry(7), entry(8)]} onChangeVehicle={changeVehicle} onCosts={jest.fn()} />)
    const cards = screen.getAllByLabelText(/^Vehículo comparado:/)
    expect(cards).toHaveLength(2)
    expect(screen.queryByText('Izquierda')).toBeNull()
    expect(screen.queryByText('Derecha')).toBeNull()
    for (const card of cards) expect(within(card).getByText('$ 28.900.000')).toBeOnTheScreen()
    expect(screen.getByRole('tab', { name: 'Información general' })).toBeSelected()
    expect(screen.getByText('Año')).toBeOnTheScreen()
    await fireEvent(screen.getByRole('switch', { name: 'Ocultar similitudes' }), 'valueChange', true)
    expect(screen.queryByText('Año')).toBeNull()
    await fireEvent.press(screen.getByRole('tab', { name: 'Seguridad' }))
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
    await fireEvent(screen.getByRole('switch'), 'valueChange', false)
    await fireEvent.press(screen.getByRole('tab', { name: 'Ventajas según tu diagnóstico' }))
    expect(screen.getByText('Compatibilidad con tu uso')).toBeOnTheScreen()
    await fireEvent.press(screen.getAllByRole('tab', { name: 'Costos estimados en ARS' })[0])
    expect(screen.getAllByText('$ 236.000')).toHaveLength(2)
    expect(screen.getAllByText('$ 20.700.000')).toHaveLength(2)
    expect(changeVehicle).not.toHaveBeenCalled()
  })

  it('TC-25 changes only the requested vehicle and opens its existing calculator', async () => {
    const changeVehicle = jest.fn()
    const open = jest.fn()
    await render(<ComparisonCards entries={[entry(7), entry(8)]} onChangeVehicle={changeVehicle} onCosts={open} />)
    await fireEvent.press(screen.getAllByRole('button', { name: /^Cambiar / })[1])
    expect(changeVehicle).toHaveBeenCalledWith(8)
    expect(screen.queryByText('Ver cálculo')).toBeNull()
    await fireEvent.press(screen.getByRole('tab', { name: 'Costos estimados en ARS' }))
    await fireEvent.press(screen.getAllByRole('link', { name: /^Ver cálculo completo de / })[0])
    expect(open).toHaveBeenCalledWith(7)
  })

  it('keeps unknown facts, missing photos and partial estimates explicit', async () => {
    const first = entry(7)
    first.detail.vehicle = { ...first.detail.vehicle, fotos: [], frenos_abs: false }
    first.costs.monthly.not_estimated = ['Combustible']
    await render(<ComparisonCards entries={[first, entry(8)]} onChangeVehicle={jest.fn()} onCosts={jest.fn()} />)
    expect(screen.getByText('Fotos no disponibles.')).toBeOnTheScreen()
    await fireEvent.press(screen.getAllByRole('tab', { name: 'Seguridad' })[0])
    expect(screen.getByText('No')).toBeOnTheScreen()
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0)
    await fireEvent.press(screen.getAllByRole('tab', { name: 'Costos estimados en ARS' })[0])
    expect(screen.getByText('$ 236.000 (parcial)')).toBeOnTheScreen()
    expect(screen.getByText('Combustible')).toBeOnTheScreen()
  })
})

