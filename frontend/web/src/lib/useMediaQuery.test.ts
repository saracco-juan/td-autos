import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMediaQuery } from './useMediaQuery'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useMediaQuery', () => {
  it('never matches where matchMedia does not exist', () => {
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))

    expect(result.current).toBe(false)
  })

  it('reports the current match and follows changes', () => {
    let matches = true
    let notify: () => void = () => {}
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation(() => ({
        get matches() {
          return matches
        },
        addEventListener: (_: string, listener: () => void) => {
          notify = listener
        },
        removeEventListener: vi.fn(),
      })),
    )

    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'))
    expect(result.current).toBe(true)

    matches = false
    act(() => notify())

    expect(result.current).toBe(false)
  })
})
