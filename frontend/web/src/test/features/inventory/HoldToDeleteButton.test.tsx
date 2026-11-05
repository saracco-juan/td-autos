import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HoldToDeleteButton from '../../../features/inventory/components/HoldToDeleteButton'

function beginPointerHold(button: HTMLElement) {
  const event = new MouseEvent('pointerdown', { bubbles: true, button: 0 })
  Object.defineProperty(event, 'isPrimary', { value: true })
  fireEvent(button, event)
  expect(button).toHaveAttribute('data-holding', 'true')
}

describe('HoldToDeleteButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('requires a complete hold and confirms only once', () => {
    const confirm = vi.fn()
    render(<HoldToDeleteButton onConfirm={confirm} />)
    const button = screen.getByRole('button', { name: 'ELIMINAR' })
    fireEvent.click(button)
    expect(confirm).not.toHaveBeenCalled()
    beginPointerHold(button)
    act(() => vi.advanceTimersByTime(1999))
    expect(confirm).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(confirm).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(button, { key: 'Enter' })
    act(() => vi.advanceTimersByTime(4000))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it.each(['pointerUp', 'pointerLeave', 'pointerCancel', 'blur'] as const)('cancels on %s', (event) => {
    const confirm = vi.fn()
    render(<HoldToDeleteButton onConfirm={confirm} />)
    const button = screen.getByRole('button', { name: 'ELIMINAR' })
    beginPointerHold(button)
    act(() => vi.advanceTimersByTime(1000))
    fireEvent[event](button)
    act(() => vi.advanceTimersByTime(2000))
    expect(confirm).not.toHaveBeenCalled()
  })

  it.each([' ', 'Enter'])('supports an uninterrupted keyboard hold with %j', (key) => {
    const confirm = vi.fn()
    render(<HoldToDeleteButton onConfirm={confirm} />)
    const button = screen.getByRole('button', { name: 'ELIMINAR' })
    fireEvent.keyDown(button, { key })
    fireEvent.keyDown(button, { key, repeat: true })
    act(() => vi.advanceTimersByTime(2000))
    fireEvent.keyUp(button, { key })
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('cancels an early keyboard release and allows a new complete hold', () => {
    const confirm = vi.fn()
    render(<HoldToDeleteButton onConfirm={confirm} />)
    const button = screen.getByRole('button', { name: 'ELIMINAR' })
    fireEvent.keyDown(button, { key: ' ' })
    act(() => vi.advanceTimersByTime(1000))
    fireEvent.keyUp(button, { key: ' ' })
    act(() => vi.advanceTimersByTime(2000))
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.keyDown(button, { key: ' ' })
    act(() => vi.advanceTimersByTime(2000))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('cleans up pending confirmation on unmount or window blur', () => {
    const confirm = vi.fn()
    const { unmount } = render(<HoldToDeleteButton onConfirm={confirm} />)
    const button = screen.getByRole('button', { name: 'ELIMINAR' })
    fireEvent.keyDown(button, { key: 'Enter' })
    fireEvent.blur(window)
    act(() => vi.advanceTimersByTime(2000))
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.keyDown(button, { key: 'Enter' })
    unmount()
    act(() => vi.advanceTimersByTime(2000))
    expect(confirm).not.toHaveBeenCalled()
  })
})
