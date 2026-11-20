import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Feedback from './Feedback'

afterEach(() => vi.useRealTimers())
it('keeps errors until dismissed and allows retry', () => {
  vi.useFakeTimers()
  const retry = vi.fn()
  render(<Feedback message="No se guardó" variant="error" onRetry={retry} />)
  act(() => vi.advanceTimersByTime(10000))
  expect(screen.getByRole('alert')).toHaveTextContent('No se guardó')
  fireEvent.click(screen.getByText('REINTENTAR'))
  expect(retry).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByLabelText('Cerrar notificación'))
  act(() => vi.advanceTimersByTime(250))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('pauses success while hovered and cancels the old timer on replacement', () => {
  vi.useFakeTimers()
  const view = render(<Feedback message="Guardado" />)
  act(() => vi.advanceTimersByTime(3000))
  fireEvent.mouseEnter(screen.getByRole('status'))
  act(() => vi.advanceTimersByTime(5000))
  expect(screen.getByRole('status')).toBeVisible()
  fireEvent.mouseLeave(screen.getByRole('status'))
  view.rerender(<Feedback message="Actualizado" />)
  act(() => vi.advanceTimersByTime(1250))
  expect(screen.getByRole('status')).toHaveTextContent('Actualizado')
  act(() => vi.advanceTimersByTime(3000))
  act(() => vi.advanceTimersByTime(250))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('keeps the same notification when a new message interrupts dismissal', () => {
  vi.useFakeTimers()
  const view = render(<Feedback message="Primero" />)
  const notification = screen.getByRole('status')
  fireEvent.click(screen.getByLabelText('Cerrar notificación'))
  view.rerender(<Feedback message="Segundo" />)
  expect(screen.getByRole('status')).toBe(notification)
  act(() => vi.advanceTimersByTime(500))
  expect(screen.getByRole('status')).toHaveTextContent('Segundo')
})
