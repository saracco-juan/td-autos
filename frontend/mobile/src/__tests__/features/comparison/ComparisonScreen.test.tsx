import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Button, View } from 'react-native'

import { vehicle } from '@shared/vehicles/fixtures'
import ComparisonScreen from '../../../features/comparison/ComparisonScreen'
import { ComparisonSelectionProvider, useComparisonSelection } from '../../../features/comparison/ComparisonSelection'
import * as recommendationsApi from '../../../features/recommendations/api'
import * as detailApi from '../../../features/vehicle-detail/api'
import * as costsApi from '../../../features/costs/api'
import { HttpError, NetworkError } from '../../../lib/http'
import { costs } from '../../../test-utils/costs'
import { ready, recommendation } from '../../../test-utils/recommendations'

jest.mock('../../../features/recommendations/api')
jest.mock('../../../features/vehicle-detail/api')
jest.mock('../../../features/costs/api')
jest.mock('../../../features/auth/useAuth', () => ({ useAuth: () => ({ authFetch: mockRequest }) }))
const mockRequest = jest.fn()
const mockNavigate = jest.fn()
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate, push: mockPush }) }))
const ranking = jest.mocked(recommendationsApi).fetchRecommendations
const detail = jest.mocked(detailApi).fetchVehicleDetail
const cost = jest.mocked(costsApi).fetchCosts

function Harness() {
  const { ids, notice, toggle } = useComparisonSelection()
  return <View>
    {[7, 8, 9].map((id) => <Button key={id} title={`Select ${id}`} onPress={() => toggle(id)} />)}
    <Button title="Selection" onPress={() => {}} accessibilityLabel={ids.join(',')} />
    {notice ? <Button title={notice} onPress={() => {}} /> : null}
    <ComparisonScreen />
  </View>
}

async function openPair() {
  await render(<ComparisonSelectionProvider><Harness /></ComparisonSelectionProvider>)
  await fireEvent.press(screen.getByText('Select 7'))
  await fireEvent.press(screen.getByText('Select 8'))
}

describe('HU08 RF07 comparison loading and selection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ranking.mockResolvedValue(ready([recommendation(7), recommendation(8), recommendation(9)]))
    detail.mockImplementation(async (_request, id) => ({ vehicle: { ...vehicle, id }, dealer: recommendation(id).dealer }))
    cost.mockResolvedValue(costs())
  })

  it('TC-76 asks for a complete pair with zero or one selection without fetching facts', async () => {
    await render(<ComparisonSelectionProvider><Harness /></ComparisonSelectionProvider>)
    expect(screen.getByText(/Seleccioná exactamente dos/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByText('Select 7'))
    expect(screen.getByText('1 vehículo seleccionado')).toBeOnTheScreen()
    expect(screen.queryAllByLabelText(/^Vehículo comparado:/)).toHaveLength(0)
    expect(detail).not.toHaveBeenCalled()
    expect(cost).not.toHaveBeenCalled()
  })

  it('TC-23 loads current facts and calculator defaults only for the two recommendations', async () => {
    await openPair()
    expect(await screen.findAllByLabelText(/^Vehículo comparado:/)).toHaveLength(2)
    expect(detail).toHaveBeenCalledWith(mockRequest, 7)
    expect(detail).toHaveBeenCalledWith(mockRequest, 8)
    expect(cost.mock.calls).toEqual([[mockRequest, 7], [mockRequest, 8]])
    await fireEvent.press(screen.getAllByText('VER CÁLCULO COMPLETO')[1])
    expect(mockPush).toHaveBeenCalledWith('/vehiculos/8/costos')
  })

  it('TC-24 rejects a third and TC-25 keeps the other ID for its replacement', async () => {
    await openPair()
    await screen.findAllByLabelText(/^Vehículo comparado:/)
    await fireEvent.press(screen.getByText('Select 9'))
    expect(screen.getByText('La comparación admite exactamente dos vehículos.')).toBeOnTheScreen()
    expect(screen.getByLabelText('7,8')).toBeOnTheScreen()
    await fireEvent.press(screen.getAllByText('QUITAR')[0])
    expect(screen.queryAllByLabelText(/^Vehículo comparado:/)).toHaveLength(0)
    expect(screen.getByText('Conservás el vehículo 8.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByText('Select 9'))
    expect(await screen.findAllByLabelText(/^Vehículo comparado:/)).toHaveLength(2)
    expect(screen.getByLabelText('8,9')).toBeOnTheScreen()
  })

  it('rejects an unavailable recommendation before loading its details or costs', async () => {
    ranking.mockResolvedValue(ready([recommendation(7)]))
    await openPair()
    expect(await screen.findByText(/Algún vehículo ya no está disponible/)).toBeOnTheScreen()
    expect(detail).not.toHaveBeenCalled()
    expect(cost).not.toHaveBeenCalled()
  })

  it.each([new NetworkError('offline'), new HttpError(500, {})])('allows retry after an API failure: %s', async (error) => {
    ranking.mockRejectedValueOnce(error)
    await openPair()
    await fireEvent.press(await screen.findByText('REINTENTAR'))
    expect(await screen.findAllByLabelText(/^Vehículo comparado:/)).toHaveLength(2)
    expect(ranking).toHaveBeenCalledTimes(2)
  })

  it('handles a publication removed after recommendations loaded', async () => {
    detail.mockRejectedValue(new HttpError(404, {}))
    await openPair()
    expect(await screen.findByText(/Algún vehículo ya no está disponible/)).toBeOnTheScreen()
    expect(screen.queryAllByLabelText(/^Vehículo comparado:/)).toHaveLength(0)
    await fireEvent.press(screen.getByRole('link', { name: 'Volver a recomendados' }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/recomendados'))
  })
})
