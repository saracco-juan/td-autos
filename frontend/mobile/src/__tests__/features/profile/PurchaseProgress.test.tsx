import { fireEvent, render, screen } from '@testing-library/react-native'
import PurchaseProgress from '../../../features/profile/PurchaseProgress'
import { useAuth } from '../../../features/auth/useAuth'
import { inspectionResponse } from '@shared/checklist/inspection/fixtures'
import { transferResponse } from '@shared/checklist/transfer/fixtures'

const mockPush = jest.fn()
const mockNavigate = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
  useFocusEffect: (callback: () => (() => void)) => jest.requireActual('react').useEffect(callback, [callback]),
}))
jest.mock('../../../features/auth/useAuth')
const request = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useAuth).mockReturnValue({ authFetch: request } as unknown as ReturnType<typeof useAuth>)
})

it('loads saved progress and opens the inspection for its vehicle', async () => {
  const inspection = inspectionResponse()
  request.mockImplementation(async (path: string) => path === '/api/inspecciones'
    ? { pasos: inspection.pasos, inspecciones: [inspection] } : transferResponse())
  await render(<PurchaseProgress />)
  const link = await screen.findByRole('link', { name: /Continuar inspección/ })
  await fireEvent.press(link)
  expect(mockPush).toHaveBeenCalledWith(`/vehiculos/${inspection.vehiculo.id}/inspeccion`)
  expect(request).toHaveBeenCalledWith('/api/inspecciones')
  await fireEvent.press(screen.getByRole('link', { name: /Empezar transferencia/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/transferencia')
})

it('keeps transfer available after an inspection failure and retries', async () => {
  request.mockImplementation(async (path: string) => {
    if (path === '/api/inspecciones') throw new Error('offline')
    return transferResponse()
  })
  await render(<PurchaseProgress />)
  expect(await screen.findByText('No pudimos cargar tus inspecciones.')).toBeOnTheScreen()
  expect(screen.getByRole('link', { name: /Empezar transferencia/ })).toBeOnTheScreen()
  request.mockImplementation(async (path: string) => path === '/api/inspecciones'
    ? { pasos: [], inspecciones: [] } : transferResponse())
  await fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText(/Cuando empieces una inspección/)).toBeOnTheScreen()
})
