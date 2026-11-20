import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { AccessibilityInfo, AppState } from 'react-native'
import Feedback from '../../components/Feedback'

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true)
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' })
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })
it('keeps errors visible and retries without dismissing them', async () => {
  const retry = jest.fn()
  await render(<Feedback message="No se guardó" variant="error" onRetry={retry} />)
  await act(async () => { jest.advanceTimersByTime(10000) })
  await fireEvent.press(screen.getByText('REINTENTAR'))
  expect(retry).toHaveBeenCalledTimes(1)
  expect(screen.getByText('No se guardó')).toBeTruthy()
  await fireEvent.press(screen.getByLabelText('Cerrar notificación'))
  await act(async () => { jest.advanceTimersByTime(500) })
  expect(screen.queryByText('No se guardó')).toBeNull()
})
it('gives a replacement success its own reading time', async () => {
  const view = await render(<Feedback message="Guardado" />)
  await act(async () => { jest.advanceTimersByTime(3000) })
  await view.rerender(<Feedback message="Actualizado" />)
  await act(async () => { jest.advanceTimersByTime(1500) })
  expect(screen.getByText('Actualizado')).toBeTruthy()
  await act(async () => { jest.advanceTimersByTime(2500) })
  await act(async () => { jest.advanceTimersByTime(500) })
  expect(screen.queryByText('Actualizado')).toBeNull()
})
